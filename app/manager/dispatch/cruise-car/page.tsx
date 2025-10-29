'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ManagerLayout from '@/components/ManagerLayout';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { Calendar, Car, MapPin, Clock, User, Phone, FileText, Filter, Ship, Copy } from 'lucide-react';

interface CruiseDispatchItem {
    id: string;
    usage_date: string;
    vehicle_number?: string;
    seat_number?: string;
    car_category?: string;
    car_type?: string;
    pickup_location?: string;
    dropoff_location?: string;
    pickup_datetime?: string;
    booker_name?: string;
    booker_email?: string;
    booker_phone?: string;
    pier_location?: string;
    cruise_name?: string;
    dispatch_code?: string;
    status?: string;
    pickup_confirmed_at?: string | null;
    dispatch_memo?: string | null;
    car_count?: number;
    passenger_count?: number;
    request_note?: string;
}

export default function CruiseCarDispatchPage() {
    const router = useRouter();
    const { loading: authLoading, isManager, user: authUser } = useAuth(['manager', 'admin'], '/');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<CruiseDispatchItem[]>([]);
    const [stats, setStats] = useState<{ roundtrip: number; oneway: number; total: number }>({ roundtrip: 0, oneway: 0, total: 0 });
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [filterCategory, setFilterCategory] = useState<'all' | 'roundtrip' | 'oneway'>('all');

    useEffect(() => {
        if (!authLoading && isManager && authUser) {
            loadCruiseDispatchData();
        }
    }, [authLoading, isManager, authUser, startDate, endDate, filterCategory]);

    // checkAuth 제거됨 - useAuth 훅 사용

    const loadCruiseDispatchData = async () => {
        try {
            const startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);

            // 크루즈 차량 데이터 로드 (뷰 우선, 폴백 reservation_cruise_car)
            let cruiseItems: CruiseDispatchItem[] = [];

            const { data: cruiseViewData, error: cruiseViewError } = await supabase
                .from('vw_manager_cruise_car_report')
                .select(`
                    id, reservation_id, usage_date, vehicle_number, seat_number,
                    pickup_location, dropoff_location, pickup_datetime, dispatch_code,
                    booker_name, booker_email, pier_location, car_category, car_type, created_at
                `)
                .gte('usage_date', startDateTime.toISOString())
                .lte('usage_date', endDateTime.toISOString())
                .order('usage_date', { ascending: true });

            if (!cruiseViewError && cruiseViewData) {
                // 뷰 데이터 사용
                const dedup = new Map<string, any>();
                cruiseViewData.forEach((r: any) => {
                    if (r && r.id && !dedup.has(r.id)) dedup.set(r.id, r);
                });
                const uniqueData = Array.from(dedup.values());

                // 배차 관련 추가 정보 로드
                const ids = uniqueData.map((r: any) => r.id).filter(Boolean);
                let dispatchInfo = new Map<string, any>();

                if (ids.length > 0) {
                    const { data: dispatchData } = await supabase
                        .from('reservation_cruise_car')
                        .select('id, pickup_confirmed_at, dispatch_memo, car_count, passenger_count, request_note')
                        .in('id', ids);

                    if (dispatchData) {
                        dispatchInfo = new Map(dispatchData.map((d: any) => [String(d.id), d]));
                    }
                }

                cruiseItems = uniqueData.map((r: any) => {
                    const dispatch = dispatchInfo.get(String(r.id));
                    return {
                        id: String(r.id),
                        usage_date: r.usage_date,
                        vehicle_number: r.vehicle_number || '크루즈 차량',
                        seat_number: r.seat_number,
                        car_category: r.car_category,
                        car_type: r.car_type,
                        pickup_location: r.pickup_location,
                        dropoff_location: r.dropoff_location,
                        pickup_datetime: r.pickup_datetime || r.usage_date,
                        booker_name: r.booker_name,
                        booker_email: r.booker_email,
                        pier_location: r.pier_location,
                        dispatch_code: r.dispatch_code,
                        status: 'pending',
                        pickup_confirmed_at: dispatch?.pickup_confirmed_at || null,
                        dispatch_memo: dispatch?.dispatch_memo || null,
                        car_count: dispatch?.car_count,
                        passenger_count: dispatch?.passenger_count,
                        request_note: dispatch?.request_note,
                    };
                });
            } else {
                // 폴백: reservation_cruise_car에서 로드
                const { data: cruiseData, error: cruiseError } = await supabase
                    .from('reservation_cruise_car')
                    .select(`
                        id, car_count, passenger_count, pickup_datetime, pickup_location,
                        dropoff_location, car_total_price, request_note, dispatch_code,
                        pickup_confirmed_at, dispatch_memo, created_at,
                        reservation:reservation_id (
                            re_user_id, re_type,
                            users:re_user_id (name, phone_number)
                        )
                    `)
                    .gte('pickup_datetime', startDateTime.toISOString().split('T')[0])
                    .lte('pickup_datetime', endDateTime.toISOString().split('T')[0]);

                if (cruiseError) {
                    console.error('크루즈 데이터 로드 오류:', cruiseError);
                } else {
                    cruiseItems = (cruiseData || []).map((item: any) => ({
                        id: String(item.id),
                        usage_date: item.pickup_datetime,
                        vehicle_number: `크루즈 차량 ${item.car_count}대`,
                        seat_number: `${item.passenger_count}명`,
                        pickup_location: item.pickup_location,
                        dropoff_location: item.dropoff_location,
                        pickup_datetime: item.pickup_datetime,
                        booker_name: item.reservation?.users?.name,
                        booker_phone: item.reservation?.users?.phone_number,
                        dispatch_code: item.dispatch_code || '',
                        status: 'pending',
                        pickup_confirmed_at: item.pickup_confirmed_at || null,
                        dispatch_memo: item.dispatch_memo || null,
                        car_count: item.car_count,
                        passenger_count: item.passenger_count,
                        request_note: item.request_note,
                    }));
                }
            }

            // 전체 통계
            const roundtripCount = cruiseItems.filter(item => isRoundTrip(item)).length;
            const onewayCount = cruiseItems.filter(item => isOneWay(item)).length;
            setStats({ roundtrip: roundtripCount, oneway: onewayCount, total: cruiseItems.length });

            // 필터링 적용
            let filteredData = cruiseItems;
            if (filterCategory === 'roundtrip') {
                filteredData = cruiseItems.filter(item => isRoundTrip(item));
            } else if (filterCategory === 'oneway') {
                filteredData = cruiseItems.filter(item => isOneWay(item));
            }

            setItems(filteredData);
        } catch (error) {
            console.error('데이터 로드 오류:', error);
        }
    };

    const isRoundTrip = (item: CruiseDispatchItem) => {
        const note = String(item.request_note || '').toLowerCase();
        if (/왕복|round\s?trip|roundtrip/i.test(note)) return true;
        return Boolean(item.pickup_location) && Boolean(item.dropoff_location);
    };

    const isOneWay = (item: CruiseDispatchItem) => {
        const note = String(item.request_note || '').toLowerCase();
        if (/편도|one\s?way|oneway/i.test(note)) return true;
        const hasPick = Boolean(item.pickup_location);
        const hasDrop = Boolean(item.dropoff_location);
        return (hasPick && !hasDrop) || (!hasPick && hasDrop);
    };

    const formatTime = (datetime?: string) => {
        if (!datetime) return '-';
        try {
            return new Date(datetime).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return datetime;
        }
    };

    const formatDate = (date: string) => {
        try {
            return new Date(date).toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric',
                weekday: 'short'
            });
        } catch {
            return date;
        }
    };

    const getCategoryColor = (item: CruiseDispatchItem) => {
        if (isRoundTrip(item)) return 'bg-purple-100 text-purple-800';
        if (isOneWay(item)) return 'bg-orange-100 text-orange-800';
        return 'bg-blue-100 text-blue-800';
    };

    const getCategoryLabel = (item: CruiseDispatchItem) => {
        if (isRoundTrip(item)) return '왕복';
        if (isOneWay(item)) return '편도';
        return '크루즈';
    };

    const savePickupConfirm = async (item: CruiseDispatchItem) => {
        const now = new Date().toISOString();
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, pickup_confirmed_at: now } : it));

        const { error } = await supabase
            .from('reservation_cruise_car')
            .update({ pickup_confirmed_at: now })
            .eq('id', item.id);

        if (error) {
            console.error('승차 확인 저장 오류:', error);
        }
    };

    const saveDispatchMemo = async (item: CruiseDispatchItem, memo: string) => {
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, dispatch_memo: memo } : it));

        const { error } = await supabase
            .from('reservation_cruise_car')
            .update({ dispatch_memo: memo })
            .eq('id', item.id);

        if (error) {
            console.error('배차 메모 저장 오류:', error);
        }
    };

    // 날짜별 그룹화 함수
    const groupItemsByDate = (items: CruiseDispatchItem[]) => {
        const grouped: { [key: string]: CruiseDispatchItem[] } = {};
        items.forEach(item => {
            const date = item.usage_date ? new Date(item.usage_date).toISOString().slice(0, 10) : 'unknown';
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(item);
        });
        return grouped;
    };

    const groupedItems = groupItemsByDate(items);

    // 배차 정보 복사 함수
    const copyDispatchInfo = async (item: CruiseDispatchItem) => {
        const info = [
            `🛳️ 크루즈차량 배차 정보`,
            `📅 날짜: ${formatDate(item.usage_date)}`,
            `⏰ 시간: ${formatTime(item.pickup_datetime)}`,
            `🏷️ 유형: ${getCategoryLabel(item)}`,
            `🚙 차량: ${item.vehicle_number || '미배정'}`,
            item.car_count ? `🚗 차량대수: ${item.car_count}대` : '',
            item.passenger_count ? `👥 승객수: ${item.passenger_count}명` : '',
            item.car_type ? `🏷️ 차량타입: ${item.car_type}` : '',
            `👤 예약자: ${item.booker_name || item.booker_email || '정보 없음'}`,
            item.booker_phone ? `📞 연락처: ${item.booker_phone}` : '',
            item.pickup_datetime ? `🕐 운행일시: ${new Date(item.pickup_datetime).toLocaleString('ko-KR')}` : '',
            item.pickup_location ? `📍 출발지: ${item.pickup_location}` : '',
            item.dropoff_location ? `📍 도착지: ${item.dropoff_location}` : '',
            item.pier_location ? `⚓ 선착장: ${item.pier_location}` : '',
            item.cruise_name ? `🛳️ 크루즈: ${item.cruise_name}` : '',
            item.request_note ? `📝 요청사항: ${item.request_note}` : '',
            item.dispatch_code ? `🔢 배차코드: #${item.dispatch_code}` : '',
            item.dispatch_memo ? `📝 메모: ${item.dispatch_memo}` : '',
            item.pickup_confirmed_at ? `✅ 운행확인: ${new Date(item.pickup_confirmed_at).toLocaleString('ko-KR')}` : '❌ 운행 미확인'
        ].filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(info);
            alert('배차 정보가 클립보드에 복사되었습니다.');
        } catch (error) {
            console.error('복사 실패:', error);
            // 폴백: 텍스트 영역을 만들어 복사
            const textArea = document.createElement('textarea');
            textArea.value = info;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('배차 정보가 클립보드에 복사되었습니다.');
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <ManagerLayout title="크루즈차량 배차" activeTab="dispatch-cruise-car">
            <div className="space-y-6">
                {/* 필터 섹션 */}
                <div className="bg-white border-b px-4 py-3">
                    <div className="space-y-3">
                        {/* 날짜 선택 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-3">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-600 mb-1">시작일</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-600 mb-1">종료일</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 카테고리 필터 */}
                        <div className="flex items-start gap-2">
                            <Filter className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <div className="flex space-x-2 overflow-x-auto pb-1">
                                {[
                                    { label: '전체', value: 'all' },
                                    { label: '왕복', value: 'roundtrip' },
                                    { label: '편도', value: 'oneway' },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setFilterCategory(option.value as typeof filterCategory)}
                                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${filterCategory === option.value
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 통계 카드 */}
                <div className="px-3 py-2">
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                            <div className="text-base font-semibold text-purple-600">{stats.roundtrip}</div>
                            <div className="text-[11px] text-gray-500">왕복</div>
                        </div>
                        <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                            <div className="text-base font-semibold text-orange-600">{stats.oneway}</div>
                            <div className="text-[11px] text-gray-500">편도</div>
                        </div>
                        <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                            <div className="text-base font-medium text-gray-700">{stats.total}</div>
                            <div className="text-[11px] text-gray-500">총 배차</div>
                        </div>
                    </div>
                </div>

                {/* 배차 목록 */}
                <div className="px-4 pb-6">
                    {items.length === 0 ? (
                        <div className="bg-white rounded-lg p-8 text-center">
                            <Ship className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">
                                {filterCategory === 'all' ?
                                    `${formatDate(startDate)} ~ ${formatDate(endDate)} 기간에 크루즈차량 배차 정보가 없습니다.` :
                                    `선택된 조건에 맞는 배차 정보가 없습니다.`
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedItems)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([date, dateItems]) => (
                                    <div key={date} className="space-y-3">
                                        {/* 날짜 헤더 */}
                                        <div className="flex items-center space-x-3 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                                            <Calendar className="w-5 h-5 text-purple-600" />
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-purple-900">
                                                    {formatDate(date)}
                                                </h3>
                                                <p className="text-sm text-purple-700">
                                                    {dateItems.length}건 배차
                                                </p>
                                            </div>
                                        </div>

                                        {/* 날짜별 배차 카드들 */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {dateItems.map((item) => (
                                                <div key={item.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                    {/* 카드 헤더 */}
                                                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">크루즈</span>
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {formatTime(item.pickup_datetime)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(item)}`}>
                                                                {getCategoryLabel(item)}
                                                            </span>
                                                            <button
                                                                onClick={() => copyDispatchInfo(item)}
                                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                                                title="배차 정보 복사"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* 카드 본문 */}
                                                    <div className="p-3 space-y-3">
                                                        {/* 차량 정보 */}
                                                        <div className="flex items-center space-x-3">
                                                            <Car className="w-5 h-5 text-purple-400" />
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {item.vehicle_number || '차량 미배정'}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {item.car_count && `차량: ${item.car_count}대`}
                                                                    {item.car_count && item.passenger_count && ' · '}
                                                                    {item.passenger_count && `승객: ${item.passenger_count}명`}
                                                                </div>
                                                                {item.car_type && (
                                                                    <div className="text-sm font-medium text-blue-700 mt-0.5">
                                                                        차종: {item.car_type}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {item.dispatch_code && (
                                                                <div className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                                                                    #{item.dispatch_code}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 예약자 정보 */}
                                                        <div className="flex items-center space-x-3">
                                                            <User className="w-5 h-5 text-gray-400" />
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {item.booker_name || item.booker_email || '예약자 정보 없음'}
                                                                </div>
                                                                {item.booker_phone && (
                                                                    <div className="text-xs text-gray-500 flex items-center space-x-1">
                                                                        <Phone className="w-3 h-3" />
                                                                        <span>{item.booker_phone}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 위치 정보 */}
                                                        <div className="space-y-2">
                                                            {item.pickup_datetime && (
                                                                <div className="flex items-start space-x-3">
                                                                    <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">운행일시</div>
                                                                        <div className="text-sm text-gray-900">
                                                                            {new Date(item.pickup_datetime).toLocaleString('ko-KR')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.pickup_location && (
                                                                <div className="flex items-start space-x-3">
                                                                    <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">출발지</div>
                                                                        <div className="text-sm text-gray-900">{item.pickup_location}</div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.dropoff_location && (
                                                                <div className="flex items-start space-x-3">
                                                                    <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">도착지</div>
                                                                        <div className="text-sm text-gray-900">{item.dropoff_location}</div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.pier_location && (
                                                                <div className="flex items-start space-x-3">
                                                                    <Ship className="w-5 h-5 text-blue-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">선착장</div>
                                                                        <div className="text-sm text-gray-900">{item.pier_location}</div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.cruise_name && (
                                                                <div className="flex items-start space-x-3">
                                                                    <FileText className="w-5 h-5 text-purple-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">크루즈</div>
                                                                        <div className="text-sm text-gray-900">{item.cruise_name}</div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.request_note && (
                                                                <div className="flex items-start space-x-3">
                                                                    <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">요청사항</div>
                                                                        <div className="text-sm text-gray-900">{item.request_note}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 확인/메모 */}
                                                        <div className="pt-2 border-t space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-xs text-gray-600">
                                                                    {item.pickup_confirmed_at
                                                                        ? `운행 확인: ${new Date(item.pickup_confirmed_at).toLocaleString('ko-KR')}`
                                                                        : '운행 미확인'
                                                                    }
                                                                </div>
                                                                {!item.pickup_confirmed_at && (
                                                                    <button
                                                                        onClick={() => savePickupConfirm(item)}
                                                                        className="bg-purple-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-purple-700"
                                                                    >
                                                                        운행 확인
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-600 mb-1">배차 메모</label>
                                                                <textarea
                                                                    defaultValue={item.dispatch_memo || ''}
                                                                    onBlur={(e) => saveDispatchMemo(item, e.currentTarget.value)}
                                                                    placeholder="메모를 입력하세요"
                                                                    className="w-full border border-gray-200 rounded p-2 text-sm"
                                                                    rows={2}
                                                                />
                                                                <div className="text-[11px] text-gray-400 mt-1">포커스가 벗어나면 자동 저장됩니다.</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                <style>
                    {`
                @media print {
                    .sticky { position: static !important; }
                    button { display: none !important; }
                    .print\\:hidden { display: none !important; }
                }
                `}
                </style>
            </div>
        </ManagerLayout>
    );
}