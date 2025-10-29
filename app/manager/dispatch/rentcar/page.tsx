'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ManagerLayout from '@/components/ManagerLayout';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { Calendar, Car, Clock, FileText, Filter, MapPin, User, Phone, Map as MapIcon, Copy } from 'lucide-react';

interface RentcarDispatchItem {
    id: string; // prefixed id: rentcar_<uuid>
    pickup_datetime: string; // ISO
    pickup_location?: string | null;
    destination?: string | null;
    via_location?: string | null;
    via_waiting?: string | number | null;
    rentcar_count?: number | null;
    car_count?: number | null;
    passenger_count?: number | null;
    request_note?: string | null;
    dispatch_code?: string | null;
    created_at?: string | null;
    booker_name?: string | null;
    booker_email?: string | null;
    booker_phone?: string | null;
    pickup_confirmed_at?: string | null;
    dispatch_memo?: string | null;
    rent_car_type?: string | null;
    rentcar_price_code?: string | null;
}

export default function RentcarDispatchPage() {
    const router = useRouter();
    const { loading: authLoading, isManager, user: authUser } = useAuth(['manager', 'admin'], '/');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<RentcarDispatchItem[]>([]);
    const [stats, setStats] = useState<{ pickup: number; sending: number; total: number }>({ pickup: 0, sending: 0, total: 0 });
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

    useEffect(() => {
        if (!authLoading && isManager && authUser) {
            loadData();
        }
    }, [authLoading, isManager, authUser, startDate, endDate]);

    // checkAuth 제거됨 - useAuth 훅 사용

    const loadData = async () => {
        try {
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            const { data, error } = await supabase
                .from('reservation_rentcar')
                .select(`
          id,
                    reservation_id,
          pickup_datetime,
          pickup_location,
          destination,
          via_location,
          via_waiting,
          rentcar_count,
          car_count,
          passenger_count,
          request_note,
          dispatch_code,
          rentcar_price_code,
                    created_at
        `)
                .gte('pickup_datetime', start.toISOString())
                .lte('pickup_datetime', end.toISOString())
                .order('pickup_datetime', { ascending: true });

            if (error) { console.error('렌터카 배차 데이터 로드 오류:', error); setItems([]); setStats({ pickup: 0, sending: 0, total: 0 }); return; }

            // 차종 정보 로드
            const priceCodes = Array.from(new Set((data || []).map((r: any) => r.rentcar_price_code).filter(Boolean)));
            let carTypeInfoMap = new Map<string, string>();
            if (priceCodes.length > 0) {
                const { data: carTypes, error: carTypeErr } = await supabase
                    .from('rent_price')
                    .select('rent_code, rent_car_type')
                    .in('rent_code', priceCodes);
                if (!carTypeErr && carTypes) {
                    carTypeInfoMap = new Map<string, string>(carTypes.map((c: any) => [c.rent_code, c.rent_car_type]));
                }
            }

            // 예약자 정보는 manager_reservations 뷰로 일괄 보강 (중첩 임베드 모호성 회피)
            const reservationIds = Array.from(new Set((data || []).map((r: any) => r.reservation_id).filter(Boolean)));
            let reservationInfoMap = new Map<string, any>();
            if (reservationIds.length > 0) {
                const { data: reInfos, error: reErr } = await supabase
                    .from('manager_reservations')
                    .select('re_id, customer_name, customer_email, customer_phone')
                    .in('re_id', reservationIds);
                if (!reErr && reInfos) {
                    reservationInfoMap = new Map<string, any>(reInfos.map((r: any) => [String(r.re_id), r]));
                }
            }

            let mapped: RentcarDispatchItem[] = (data || []).map((r: any) => ({
                id: `rentcar_${r.id}`,
                pickup_datetime: r.pickup_datetime,
                pickup_location: r.pickup_location,
                destination: r.destination,
                via_location: r.via_location,
                via_waiting: r.via_waiting,
                rentcar_count: r.rentcar_count,
                car_count: r.car_count,
                passenger_count: r.passenger_count,
                request_note: r.request_note,
                dispatch_code: r.dispatch_code,
                created_at: r.created_at,
                booker_name: reservationInfoMap.get(String(r.reservation_id))?.customer_name || null,
                booker_email: reservationInfoMap.get(String(r.reservation_id))?.customer_email || null,
                booker_phone: reservationInfoMap.get(String(r.reservation_id))?.customer_phone || null,
                pickup_confirmed_at: null,
                dispatch_memo: null,
                rent_car_type: carTypeInfoMap.get(r.rentcar_price_code) || null,
                rentcar_price_code: r.rentcar_price_code,
            }));

            // 보강: 새 컬럼 확인/메모 로드
            const ids = (data || []).map((r: any) => r.id);
            if (ids.length > 0) {
                const { data: extras, error: extrasErr } = await supabase
                    .from('reservation_rentcar')
                    .select('id, pickup_confirmed_at, dispatch_memo')
                    .in('id', ids);
                if (!extrasErr && extras) {
                    const map = new Map<string, any>(extras.map((e: any) => [String(e.id), e]));
                    mapped = mapped.map((it) => {
                        const rawId = it.id.replace(/^rentcar_/, '');
                        const ex = map.get(rawId);
                        return ex ? { ...it, pickup_confirmed_at: ex.pickup_confirmed_at || null, dispatch_memo: ex.dispatch_memo || null } : it;
                    });
                }
            }

            setItems(mapped);

            // 당일/다른날 통계 계산
            const todayCount = mapped.filter(item => isToday(item)).length;
            const otherDayCount = mapped.filter(item => !isToday(item)).length;
            setStats({ pickup: todayCount, sending: otherDayCount, total: mapped.length });
        } catch (e) {
            console.error('데이터 로드 오류:', e);
        }
    };

    const formatTime = (datetime?: string | null) => { if (!datetime) return '-'; try { return new Date(datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); } catch { return String(datetime); } };
    const formatDate = (date: string) => { try { return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }); } catch { return date; } };

    const isToday = (item: RentcarDispatchItem) => {
        const today = new Date().toISOString().slice(0, 10);
        const pickupDate = item.pickup_datetime ? new Date(item.pickup_datetime).toISOString().slice(0, 10) : '';
        return today === pickupDate;
    };

    const savePickupConfirm = async (item: RentcarDispatchItem) => {
        const id = item.id.replace(/^rentcar_/, '');
        const now = new Date().toISOString();
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, pickup_confirmed_at: now } : it));
        const { error } = await supabase.from('reservation_rentcar').update({ pickup_confirmed_at: now }).eq('id', id);
        if (error) console.error('승차 확인 저장 오류(렌터카):', error);
    };
    const saveDispatchMemo = async (item: RentcarDispatchItem, memo: string) => {
        const id = item.id.replace(/^rentcar_/, '');
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, dispatch_memo: memo } : it));
        const { error } = await supabase.from('reservation_rentcar').update({ dispatch_memo: memo }).eq('id', id);
        if (error) console.error('배차 메모 저장 오류(렌터카):', error);
    };

    // 날짜별 그룹화 함수
    const groupItemsByDate = (items: RentcarDispatchItem[]) => {
        const grouped: { [key: string]: RentcarDispatchItem[] } = {};
        items.forEach(item => {
            const date = item.pickup_datetime ? new Date(item.pickup_datetime).toISOString().slice(0, 10) : 'unknown';
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(item);
        });
        return grouped;
    };

    const groupedItems = groupItemsByDate(items);

    // 배차 정보 복사 함수
    const copyDispatchInfo = async (item: RentcarDispatchItem) => {
        const info = [
            `🚗 렌터카 배차 정보`,
            `📅 날짜: ${formatDate(item.pickup_datetime)}`,
            `⏰ 시간: ${formatTime(item.pickup_datetime)}`,
            `🚙 차량: ${item.car_count ?? item.rentcar_count ?? '-'}대`,
            `👥 승객: ${item.passenger_count ?? '-'}명`,
            `👤 예약자: ${item.booker_name || item.booker_email || '정보 없음'}`,
            item.booker_phone ? `📞 연락처: ${item.booker_phone}` : '',
            item.pickup_datetime ? `🕐 픽업일시: ${new Date(item.pickup_datetime).toLocaleString('ko-KR')}` : '',
            item.pickup_location ? `📍 승차: ${item.pickup_location}` : '',
            item.destination ? `📍 하차: ${item.destination}` : '',
            item.via_location ? `🔄 경유지: ${item.via_location}${item.via_waiting ? ` (대기 ${item.via_waiting}분)` : ''}` : '',
            item.request_note ? `📝 요청사항: ${item.request_note}` : '',
            item.dispatch_code ? `🔢 배차코드: #${item.dispatch_code}` : '',
            item.dispatch_memo ? `📝 메모: ${item.dispatch_memo}` : '',
            item.pickup_confirmed_at ? `✅ 승차확인: ${new Date(item.pickup_confirmed_at).toLocaleString('ko-KR')}` : '❌ 승차 미확인'
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <ManagerLayout title="렌터카 배차" activeTab="dispatch-rentcar">
            <div className="space-y-6">
                <div className="bg-white border-b px-4 py-3">
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-3">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-600 mb-1">시작일</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-600 mb-1">종료일</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 text-gray-500 text-sm"><Filter className="w-5 h-5" /> 렌터카 서비스</div>
                    </div>
                </div>

                <div className="px-3 py-2">
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                            <div className="text-base font-semibold text-green-600">{stats.pickup}</div>
                            <div className="text-[11px] text-gray-500">당일</div>
                        </div>
                        <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                            <div className="text-base font-semibold text-blue-600">{stats.sending}</div>
                            <div className="text-[11px] text-gray-500">다른날</div>
                        </div>
                        <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                            <div className="text-base font-medium text-gray-700">{stats.total}</div>
                            <div className="text-[11px] text-gray-500">총 배차</div>
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-6">
                    {items.length === 0 ? (
                        <div className="bg-white rounded-lg p-8 text-center">
                            <MapIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">{`${formatDate(startDate)} ~ ${formatDate(endDate)} 기간에 렌터카 배차 정보가 없습니다.`}</p>
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
                                                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">렌터카</span>
                                                            <span className="text-sm font-medium text-gray-900">{formatTime(item.pickup_datetime)}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isToday(item) ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                                                {isToday(item) ? '당일' : '다른날'}
                                                            </span>
                                                            <button
                                                                onClick={() => copyDispatchInfo(item)}
                                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                                                title="배차 정보 복사"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">대기중</span>
                                                        </div>
                                                    </div>                                                    <div className="p-3 space-y-3">
                                                        <div className="flex items-center space-x-3">
                                                            <Car className="w-5 h-5 text-purple-400" />
                                                            <div className="flex-1">
                                                                <div className="text-sm text-gray-900">
                                                                    차량 {item.car_count ?? item.rentcar_count ?? '-'}대 · 승객 {item.passenger_count ?? '-'}명
                                                                </div>
                                                                {item.rent_car_type && (
                                                                    <div className="text-sm font-medium text-blue-700 mt-0.5">
                                                                        차종: {item.rent_car_type}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {item.dispatch_code && (
                                                                <div className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">#{item.dispatch_code}</div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center space-x-3">
                                                            <User className="w-5 h-5 text-gray-400" />
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium text-gray-900">{item.booker_name || item.booker_email || '예약자 정보 없음'}</div>
                                                                {item.booker_phone && (
                                                                    <div className="text-xs text-gray-500 flex items-center space-x-1"><Phone className="w-3 h-3" /><span>{item.booker_phone}</span></div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex items-start space-x-3">
                                                                <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                                                                <div className="flex-1">
                                                                    <div className="text-xs text-gray-500">픽업일시</div>
                                                                    <div className="text-sm text-gray-900">{new Date(item.pickup_datetime).toLocaleString('ko-KR')}</div>
                                                                </div>
                                                            </div>
                                                            {item.pickup_location && (
                                                                <div className="flex items-start space-x-3">
                                                                    <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">승차</div>
                                                                        <div className="text-sm text-gray-900">{item.pickup_location}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {item.destination && (
                                                                <div className="flex items-start space-x-3">
                                                                    <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">하차</div>
                                                                        <div className="text-sm text-gray-900">{item.destination}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {item.via_location && (
                                                                <div className="flex items-start space-x-3">
                                                                    <MapPin className="w-5 h-5 text-yellow-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">경유지</div>
                                                                        <div className="text-sm text-gray-900">{item.via_location} {item.via_waiting ? `(대기 ${item.via_waiting}분)` : ''}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {item.request_note && (
                                                                <div className="flex items-start space-x-3">
                                                                    <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">요청사항</div>
                                                                        <div className="text-sm text-gray-900 whitespace-pre-wrap">{item.request_note}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="pt-2 border-t space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-xs text-gray-600">{item.pickup_confirmed_at ? `승차 확인: ${new Date(item.pickup_confirmed_at).toLocaleString('ko-KR')}` : '승차 미확인'}</div>
                                                                {!item.pickup_confirmed_at && (
                                                                    <button onClick={() => savePickupConfirm(item)} className="bg-purple-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-purple-700">승차 확인</button>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-600 mb-1">배차 메모</label>
                                                                <textarea defaultValue={item.dispatch_memo || ''} onBlur={(e) => saveDispatchMemo(item, e.currentTarget.value)} placeholder="메모를 입력하세요" className="w-full border border-gray-200 rounded p-2 text-sm" rows={2} />
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

                <style>{`
        @media print {
          .sticky { position: static !important; }
          button { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
            </div>
        </ManagerLayout>
    );
}
