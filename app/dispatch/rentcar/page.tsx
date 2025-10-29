'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Calendar, Car, Clock, FileText, Filter, MapPin, Printer, User, Phone, Map as MapIcon, Copy } from 'lucide-react';

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
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<RentcarDispatchItem[]>([]);
    const [stats, setStats] = useState<{ total: number }>({ total: 0 });
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => { checkAuth(); }, []);
    useEffect(() => { if (user) loadData(); }, [user, selectedDate]);

    const checkAuth = async () => {
        try {
            const { data: { user: authUser }, error } = await supabase.auth.getUser();
            if (error || !authUser) { router.push('/login'); return; }
            const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
            if (!profile || !['dispatcher', 'manager', 'admin'].includes(profile.role)) { alert('배차 담당자, 매니저 또는 관리자 권한이 필요합니다.'); router.push('/'); return; }
            setUser(authUser);
        } catch (e) { console.error('인증 오류:', e); router.push('/login'); } finally { setLoading(false); }
    };

    const loadData = async () => {
        try {
            const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);

            console.debug('🚙 렌트카 배차 데이터 로드 시작:', { selectedDate, start: start.toISOString(), end: end.toISOString() });

            // 먼저 vw_manager_rentcar_report 뷰를 시도
            let data: any[] = [];
            let fromView = false;

            try {
                console.debug('🔍 vw_manager_rentcar_report 뷰 조회 시도...');
                const { data: viewData, error: viewError } = await supabase
                    .from('vw_manager_rentcar_report')
                    .select('*')
                    .gte('pickup_datetime', start.toISOString())
                    .lte('pickup_datetime', end.toISOString())
                    .order('pickup_datetime', { ascending: true });

                if (viewError) {
                    console.debug('⚠️ 뷰 조회 실패, 테이블 직접 조회로 전환:', viewError.code, viewError.message);
                } else {
                    console.debug('✅ 뷰에서 데이터 로드 성공:', viewData?.length || 0, '건');
                    data = viewData || [];
                    fromView = true;
                }
            } catch (viewErr) {
                console.debug('⚠️ 뷰 조회 예외:', viewErr);
            }

            // 뷰에서 실패한 경우 기존 방식으로 폴백
            if (!fromView) {
                console.debug('📋 기존 테이블 방식으로 데이터 조회...');
                const { data: tableData, error } = await supabase
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
                        pickup_confirmed_at,
                        dispatch_memo,
                        created_at
                    `)
                    .gte('pickup_datetime', start.toISOString())
                    .lte('pickup_datetime', end.toISOString())
                    .order('pickup_datetime', { ascending: true });

                if (error) {
                    console.error('렌터카 배차 데이터 로드 오류:', error);
                    setItems([]);
                    setStats({ total: 0 });
                    return;
                }

                data = tableData || [];

                // 차종 정보 로드
                const priceCodes = Array.from(new Set(data.map((r: any) => r.rentcar_price_code).filter(Boolean)));
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

                // 예약자 정보 로드 (테이블 직접 조회)
                const reservationIds = Array.from(new Set(data.map((r: any) => r.reservation_id).filter(Boolean)));
                let reservationInfoMap = new Map<string, any>();
                if (reservationIds.length > 0) {
                    console.debug('👤 예약자 정보 조회:', reservationIds.length, '건');
                    const { data: reservations, error: resErr } = await supabase
                        .from('reservation')
                        .select('re_id, re_user_id')
                        .in('re_id', reservationIds);

                    if (!resErr && reservations) {
                        const userIds = reservations.map((r: any) => r.re_user_id).filter(Boolean);
                        if (userIds.length > 0) {
                            const { data: users, error: userErr } = await supabase
                                .from('users')
                                .select('id, name, email, phone_number')
                                .in('id', userIds);

                            if (!userErr && users) {
                                const userMap = new Map(users.map((u: any) => [u.id, u]));
                                reservations.forEach((r: any) => {
                                    const user = userMap.get(r.re_user_id);
                                    if (user) {
                                        reservationInfoMap.set(String(r.re_id), {
                                            customer_name: user.name,
                                            customer_email: user.email,
                                            customer_phone: user.phone_number
                                        });
                                    }
                                });
                            }
                        }
                    }
                }

                // 기존 방식으로 매핑
                data = data.map((r: any) => ({
                    ...r,
                    booker_name: reservationInfoMap.get(String(r.reservation_id))?.customer_name || null,
                    booker_email: reservationInfoMap.get(String(r.reservation_id))?.customer_email || null,
                    booker_phone: reservationInfoMap.get(String(r.reservation_id))?.customer_phone || null,
                    rent_car_type: carTypeInfoMap.get(r.rentcar_price_code) || null,
                }));
            }

            console.debug('📊 렌트카 매핑 결과:', data.length, '건', fromView ? '(뷰 사용)' : '(테이블 직접)');

            let mapped: RentcarDispatchItem[] = data.map((r: any) => ({
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
                booker_name: r.booker_name || null,
                booker_email: r.booker_email || null,
                booker_phone: r.booker_phone || null,
                pickup_confirmed_at: r.pickup_confirmed_at || null,
                dispatch_memo: r.dispatch_memo || null,
                rent_car_type: r.rent_car_type || null,
                rentcar_price_code: r.rentcar_price_code,
            }));

            setItems(mapped);
            setStats({ total: mapped.length });
            console.debug('✅ 렌트카 배차 데이터 로드 완료:', mapped.length, '건');
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

    const copyDispatchInfo = async (item: RentcarDispatchItem) => {
        const info = [
            `🚙 렌터카 배차 정보`,
            `차량: ${item.car_count ?? item.rentcar_count ?? '-'}대, 승객: ${item.passenger_count ?? '-'}명`,
            `픽업시간: ${new Date(item.pickup_datetime).toLocaleString('ko-KR')}`,
            item.pickup_location ? `승차: ${item.pickup_location}` : null,
            item.destination ? `하차: ${item.destination}` : null,
            item.via_location ? `경유지: ${item.via_location}${item.via_waiting ? ` (대기 ${item.via_waiting}분)` : ''}` : null,
            `예약자: ${item.booker_name || item.booker_email || '정보 없음'}`,
            item.booker_phone ? `연락처: ${item.booker_phone}` : null,
            item.dispatch_code ? `배차코드: #${item.dispatch_code}` : null,
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
                            <MapIcon className="w-6 h-6 text-purple-600" />
                            <h1 className="text-lg font-semibold text-gray-900">렌터카 배차</h1>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => router.push('/dispatch')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                                ← 배차센터
                            </button>
                            <button onClick={() => { const t = document.title; document.title = `${formatDate(selectedDate)} 렌터카 배차`; window.print(); document.title = t; }} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
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
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                    <div className="flex items-start gap-2 text-gray-500 text-sm"><Filter className="w-5 h-5" /> 렌터카 서비스</div>
                </div>
            </div>

            <div className="px-3 py-2">
                <div className="flex gap-2">
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
                        <p className="text-gray-500">{`${formatDate(selectedDate)} 날짜에 렌터카 배차 정보가 없습니다.`}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div key={item.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                                    <div className="flex items-center space-x-2">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">렌터카</span>
                                        <span className="text-sm font-medium text-gray-900">{formatTime(item.pickup_datetime)}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isToday(item) ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {isToday(item) ? '당일' : '다른날'}
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
