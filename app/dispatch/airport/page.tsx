'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Calendar, Car, Clock, FileText, Filter, MapPin, Plane, Printer, User, Phone, Copy, Mail } from 'lucide-react';

interface AirportDispatchItem {
    id: string; // prefixed id: airport_<uuid>
    ra_datetime: string; // ISO string
    ra_airport_location?: string | null;
    ra_flight_number?: string | null;
    ra_stopover_location?: string | null;
    ra_stopover_wait_minutes?: number | null;
    ra_car_count?: number | null;
    ra_passenger_count?: number | null;
    ra_luggage_count?: number | null;
    request_note?: string | null;
    dispatch_code?: string | null;
    created_at?: string | null;
    booker_name?: string | null;
    booker_email?: string | null;
    booker_phone?: string | null;
    pickup_confirmed_at?: string | null;
    dispatch_memo?: string | null;
    airport_car_type?: string | null;
    airport_price_code?: string | null;
    airport_category?: string | null; // 픽업/샌딩 구분용
    airport_route?: string | null; // 공항 경로
    airport_price?: number | null; // 공항 가격
}

export default function AirportDispatchPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<AirportDispatchItem[]>([]);
    const [stats, setStats] = useState<{ pickup: number; sending: number; total: number }>({ pickup: 0, sending: 0, total: 0 });
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (user) loadData();
    }, [user, selectedDate]);

    const checkAuth = async () => {
        try {
            const { data: { user: authUser }, error } = await supabase.auth.getUser();
            if (error || !authUser) {
                router.push('/login');
                return;
            }
            const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', authUser.id)
                .single();
            if (!profile || !['dispatcher', 'manager', 'admin'].includes(profile.role)) {
                alert('배차 담당자, 매니저 또는 관리자 권한이 필요합니다.');
                router.push('/');
                return;
            }
            setUser(authUser);
        } catch (e) {
            console.error('인증 오류:', e);
            router.push('/login');
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            const day = selectedDate; // YYYY-MM-DD
            const startStr = `${day} 00:00:00`;
            const endStr = `${day} 23:59:59`;

            // 먼저 vw_manager_airport_report 뷰가 있는지 확인하고 사용, 없으면 기본 테이블 사용
            let { data, error } = await supabase
                .from('vw_manager_airport_report')
                .select(`
                    id, reservation_id, ra_datetime, ra_airport_location, ra_flight_number,
                    ra_stopover_location, ra_stopover_wait_minutes, ra_car_count, 
                    ra_passenger_count, ra_luggage_count, request_note, dispatch_code,
                    airport_price_code, pickup_confirmed_at, dispatch_memo, created_at, 
                    booker_name, booker_email, booker_phone, airport_category, 
                    airport_route, airport_car_type, airport_price
                `)
                .gte('ra_datetime', startStr)
                .lte('ra_datetime', endStr)
                .order('ra_datetime', { ascending: true });

            // 뷰가 없으면 기본 테이블 사용
            if (error && error.code === '42P01') {
                console.debug('📋 뷰를 찾을 수 없음, 기본 테이블 사용');
                ({ data, error } = await supabase
                    .from('reservation_airport')
                    .select(`
                        id, reservation_id, ra_datetime, ra_airport_location, ra_flight_number,
                        ra_stopover_location, ra_stopover_wait_minutes, ra_car_count,
                        ra_passenger_count, ra_luggage_count, request_note, dispatch_code,
                        airport_price_code, pickup_confirmed_at, dispatch_memo, created_at
                    `)
                    .gte('ra_datetime', startStr)
                    .lte('ra_datetime', endStr)
                    .order('ra_datetime', { ascending: true }));
            }

            if (error) {
                console.error('공항 배차 데이터 로드 오류:', error);
                setItems([]);
                setStats({ pickup: 0, sending: 0, total: 0 });
                return;
            }

            let reservationInfoMap = new Map<string, any>();

            // 뷰에서 예약자 정보가 없는 경우에만 별도 조회
            const needsBookerInfo = (data || []).some((r: any) => !r.booker_name && !r.booker_email);

            if (needsBookerInfo) {
                console.debug('📋 예약자 정보 추가 조회 필요');
                const reservationIds = Array.from(new Set((data || []).map((r: any) => r.reservation_id).filter(Boolean)));

                if (reservationIds.length > 0) {
                    // 직접 reservation 테이블에서 사용자 ID 조회
                    const { data: resRows, error: resErr } = await supabase
                        .from('reservation')
                        .select('re_id, re_user_id')
                        .in('re_id', reservationIds);

                    if (!resErr && resRows && resRows.length > 0) {
                        const userIds = Array.from(new Set(resRows.map((r: any) => r.re_user_id).filter(Boolean)));

                        if (userIds.length > 0) {
                            const { data: usersRows, error: usersErr } = await supabase
                                .from('users')
                                .select('id, name, email, phone_number')
                                .in('id', userIds);

                            if (!usersErr && usersRows) {
                                const userMap = new Map<string, any>(usersRows.map((u: any) => [String(u.id), u]));
                                for (const row of resRows) {
                                    const u = userMap.get(String(row.re_user_id));
                                    if (u) {
                                        reservationInfoMap.set(String(row.re_id), {
                                            customer_name: u.name || null,
                                            customer_email: u.email || null,
                                            customer_phone: u.phone_number || null,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 공항 카테고리 및 차종 정보 로드 (기본 테이블 사용시)
            const priceCodes = Array.from(new Set((data || []).map((r: any) => r.airport_price_code).filter(Boolean)));
            let airportInfoMap = new Map<string, any>();
            if (priceCodes.length > 0) {
                const { data: airportInfo, error: airportErr } = await supabase
                    .from('airport_price')
                    .select('airport_code, airport_category, airport_route, airport_car_type, price')
                    .in('airport_code', priceCodes);
                if (!airportErr && airportInfo) {
                    airportInfoMap = new Map<string, any>(airportInfo.map((c: any) => [c.airport_code, c]));
                }
            }

            let mapped: AirportDispatchItem[] = (data || []).map((r: any) => {
                const airportData = airportInfoMap.get(r.airport_price_code);
                return {
                    id: `airport_${r.id}`,
                    ra_datetime: r.ra_datetime,
                    ra_airport_location: r.ra_airport_location,
                    ra_flight_number: r.ra_flight_number,
                    ra_stopover_location: r.ra_stopover_location,
                    ra_stopover_wait_minutes: r.ra_stopover_wait_minutes,
                    ra_car_count: r.ra_car_count,
                    ra_passenger_count: r.ra_passenger_count,
                    ra_luggage_count: r.ra_luggage_count,
                    request_note: r.request_note,
                    dispatch_code: r.dispatch_code,
                    created_at: r.created_at,
                    // 뷰에서 직접 가져오거나, 별도 조회한 정보 사용
                    booker_name: r.booker_name || reservationInfoMap.get(String(r.reservation_id))?.customer_name || null,
                    booker_email: r.booker_email || reservationInfoMap.get(String(r.reservation_id))?.customer_email || null,
                    booker_phone: r.booker_phone || reservationInfoMap.get(String(r.reservation_id))?.customer_phone || null,
                    pickup_confirmed_at: r.pickup_confirmed_at || null,
                    dispatch_memo: r.dispatch_memo || null,
                    airport_car_type: r.airport_car_type || airportData?.airport_car_type || null,
                    airport_price_code: r.airport_price_code,
                    airport_category: r.airport_category || airportData?.airport_category || null,
                    airport_route: r.airport_route || airportData?.airport_route || null,
                    airport_price: r.airport_price || airportData?.price || null,
                };
            });

            // 디버그: 로드된 건수 확인
            console.debug('📋 공항 배차 로드:', mapped.length, '건', '범위:', startStr, '~', endStr);
            setItems(mapped);

            // 픽업/샌딩 통계 계산
            const pickupCount = mapped.filter(item => isPickup(item)).length;
            const sendingCount = mapped.filter(item => isSending(item)).length;
            setStats({ pickup: pickupCount, sending: sendingCount, total: mapped.length });
        } catch (e) {
            console.error('데이터 로드 오류:', e);
        }
    };

    const formatTime = (datetime?: string | null) => {
        if (!datetime) return '-';
        try {
            return new Date(datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        } catch { return String(datetime); }
    };
    const formatDate = (date: string) => {
        try {
            return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
        } catch { return date; }
    };

    const isPickup = (item: AirportDispatchItem) => {
        // 1. airport_category 정보가 있으면 우선 사용
        if (item.airport_category) {
            return /픽업|pickup/i.test(item.airport_category);
        }

        // 2. request_note에서 키워드 확인
        const note = String(item.request_note || '').toLowerCase();
        if (/샌딩|보내기|공항샌딩|airport\s*sending|샌딩|send/i.test(note)) {
            return false;
        }

        // 3. 경유지가 있는 경우는 샌딩 (공항으로 가는 경로)
        if (item.ra_stopover_location) {
            return false;
        }

        // 4. 그 외에는 픽업으로 간주
        return true;
    };

    const isSending = (item: AirportDispatchItem) => {
        return !isPickup(item);
    };

    const savePickupConfirm = async (item: AirportDispatchItem) => {
        const id = item.id.replace(/^airport_/, '');
        const now = new Date().toISOString();
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, pickup_confirmed_at: now } : it));
        const { error } = await supabase.from('reservation_airport').update({ pickup_confirmed_at: now }).eq('id', id);
        if (error) console.error('승차 확인 저장 오류(공항):', error);
    };
    const saveDispatchMemo = async (item: AirportDispatchItem, memo: string) => {
        const id = item.id.replace(/^airport_/, '');
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, dispatch_memo: memo } : it));
        const { error } = await supabase.from('reservation_airport').update({ dispatch_memo: memo }).eq('id', id);
        if (error) console.error('배차 메모 저장 오류(공항):', error);
    };

    const copyDispatchInfo = async (item: AirportDispatchItem) => {
        const info = [
            `✈️ 공항 배차 정보`,
            `차량: ${item.ra_car_count ?? '-'}대, 승객: ${item.ra_passenger_count ?? '-'}명, 짐: ${item.ra_luggage_count ?? '-'}개`,
            `탑승시간: ${new Date(item.ra_datetime).toLocaleString('ko-KR')}`,
            item.ra_airport_location ? `공항/위치: ${item.ra_airport_location}` : null,
            item.ra_flight_number ? `항공편: ${item.ra_flight_number}` : null,
            item.airport_route ? `서비스 경로: ${item.airport_route}` : null,
            item.airport_category ? `서비스 구분: ${item.airport_category}` : null,
            item.ra_stopover_location ? `경유지: ${item.ra_stopover_location}${item.ra_stopover_wait_minutes ? ` (대기 ${item.ra_stopover_wait_minutes}분)` : ''}` : null,
            `예약자: ${item.booker_name || item.booker_email || '정보 없음'}`,
            item.booker_email ? `이메일: ${item.booker_email}` : null,
            item.booker_phone ? `연락처: ${item.booker_phone}` : null,
            item.dispatch_code ? `배차코드: #${item.dispatch_code}` : null,
            item.airport_price ? `서비스 가격: ${item.airport_price.toLocaleString()}원` : null,
            item.request_note ? `요청사항: ${item.request_note}` : null,
            item.dispatch_memo ? `메모: ${item.dispatch_memo}` : null,
        ].filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(info);
            alert('배차 정보가 클립보드에 복사되었습니다.');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = info;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('배차 정보가 클립보드에 복사되었습니다.');
        }
    };

    if (loading) {
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
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b sticky top-0 z-40">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Plane className="w-6 h-6 text-blue-600" />
                            <h1 className="text-lg font-semibold text-gray-900">공항 배차</h1>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => router.push('/dispatch')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                                ← 배차센터
                            </button>
                            <button onClick={() => { const t = document.title; document.title = `${formatDate(selectedDate)} 공항 배차`; window.print(); document.title = t; }} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
                                <Printer className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border-b px-4 py-3">
                <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="flex items-start gap-2 text-gray-500 text-sm"><Filter className="w-5 h-5" /> 공항 서비스</div>
                </div>
            </div>

            <div className="px-3 py-2">
                <div className="flex gap-2">
                    <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                        <div className="text-base font-semibold text-green-600">{stats.pickup}</div>
                        <div className="text-[11px] text-gray-500">픽업</div>
                    </div>
                    <div className="flex-1 min-w-0 bg-white rounded-md p-2 text-center border border-gray-100">
                        <div className="text-base font-semibold text-blue-600">{stats.sending}</div>
                        <div className="text-[11px] text-gray-500">샌딩</div>
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
                        <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">{`${formatDate(selectedDate)} 날짜에 공항 배차 정보가 없습니다.`}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div key={item.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                                    <div className="flex items-center space-x-2">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">공항</span>
                                        <span className="text-sm font-medium text-gray-900">{formatTime(item.ra_datetime)}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isPickup(item) ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'}`}>
                                            {isPickup(item) ? '픽업' : '샌딩'}
                                        </span>
                                        <button
                                            onClick={() => copyDispatchInfo(item)}
                                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                            title="배차정보 복사"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">대기중</span>
                                    </div>
                                </div>

                                <div className="p-3 space-y-3">
                                    <div className="flex items-center space-x-3">
                                        <Car className="w-5 h-5 text-blue-400" />
                                        <div className="flex-1">
                                            <div className="text-sm text-gray-900">
                                                차량 {item.ra_car_count ?? '-'}대 · 승객 {item.ra_passenger_count ?? '-'}명 · 짐 {item.ra_luggage_count ?? '-'}개
                                            </div>
                                            {item.airport_car_type && (
                                                <div className="text-sm font-medium text-blue-700 mt-0.5">
                                                    차종: {item.airport_car_type}
                                                </div>
                                            )}
                                        </div>
                                        {item.dispatch_code && (
                                            <div className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">#{item.dispatch_code}</div>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <User className="w-5 h-5 text-gray-400" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">{item.booker_name || item.booker_email || '예약자 정보 없음'}</div>
                                            {item.booker_email && (
                                                <div className="text-xs text-gray-500 flex items-center space-x-1"><Mail className="w-3 h-3" /><span>{item.booker_email}</span></div>
                                            )}
                                            {item.booker_phone && (
                                                <div className="text-xs text-gray-500 flex items-center space-x-1"><Phone className="w-3 h-3" /><span>{item.booker_phone}</span></div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-start space-x-3">
                                            <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                                            <div className="flex-1">
                                                <div className="text-xs text-gray-500">탑승일시</div>
                                                <div className="text-sm text-gray-900">{new Date(item.ra_datetime).toLocaleString('ko-KR')}</div>
                                            </div>
                                        </div>
                                        {/* 1. 서비스 경로 */}
                                        {item.airport_route && (
                                            <div className="flex items-start space-x-3">
                                                <MapPin className="w-5 h-5 text-indigo-500 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="text-xs text-gray-500">서비스 경로</div>
                                                    <div className="text-sm text-gray-900 font-medium">{item.airport_route}</div>
                                                    {item.airport_category && (
                                                        <div className="text-xs text-indigo-600 mt-0.5">
                                                            [{item.airport_category}]
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {/* 2. 항공편 */}
                                        {item.ra_flight_number && (
                                            <div className="flex items-start space-x-3">
                                                <Plane className="w-5 h-5 text-blue-500 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="text-xs text-gray-500">항공편</div>
                                                    <div className="text-sm text-gray-900">{item.ra_flight_number}</div>
                                                </div>
                                            </div>
                                        )}
                                        {/* 3. 픽업/샌딩 경로 */}
                                        <div className="flex items-start space-x-3">
                                            <MapPin className={`w-5 h-5 mt-0.5 ${isPickup(item) ? 'text-orange-500' : 'text-purple-500'}`} />
                                            <div className="flex-1">
                                                <div className="text-xs text-gray-500">
                                                    {isPickup(item) ? '픽업 경로' : '샌딩 경로'}
                                                </div>
                                                <div className="text-sm text-gray-900">
                                                    {isPickup(item) ? (
                                                        // 픽업: 공항명 → 장소명
                                                        <>
                                                            <span className="font-medium text-blue-600">{item.ra_airport_location || '공항'}</span>
                                                            {item.ra_stopover_location && (
                                                                <>
                                                                    <span className="mx-2 text-gray-400">→</span>
                                                                    <span>{item.ra_stopover_location}</span>
                                                                    {item.ra_stopover_wait_minutes && (
                                                                        <span className="text-xs text-gray-500 ml-1">(대기 {item.ra_stopover_wait_minutes}분)</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        // 샌딩: 장소명 → 공항명
                                                        <>
                                                            {item.ra_stopover_location && (
                                                                <>
                                                                    <span>{item.ra_stopover_location}</span>
                                                                    <span className="mx-2 text-gray-400">→</span>
                                                                    {item.ra_stopover_wait_minutes && (
                                                                        <span className="text-xs text-gray-500 mr-1">(대기 {item.ra_stopover_wait_minutes}분)</span>
                                                                    )}
                                                                </>
                                                            )}
                                                            <span className="font-medium text-blue-600">{item.ra_airport_location || '공항'}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
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
                                                <button onClick={() => savePickupConfirm(item)} className="bg-blue-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-blue-700">승차 확인</button>
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
    );
}
