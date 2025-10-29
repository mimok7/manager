'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import { getExchangeRate, vndToKrw, roundKrwToHundred } from '../../../../lib/exchangeRate';
import HotelFormLite from '@/components/HotelFormLite';

function ManagerServiceTabs({ active }: { active: 'cruise' | 'airport' | 'hotel' | 'rentcar' | 'tour' }) {
    const router = useRouter();
    const params = useSearchParams();
    const quoteId = params.get('quoteId');
    const [titlesToday, setTitlesToday] = useState<any[]>([]);
    const [creating, setCreating] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const makeHref = (key: string, id?: string | null) => `/manager/quotes/${key}${id ? `?quoteId=${id}` : (quoteId ? `?quoteId=${quoteId}` : '')}`;
    const Tab = ({ keyName, label }: { keyName: typeof active; label: string }) => (
        <button type="button" onClick={() => router.push(makeHref(keyName))}
            className={`px-3 py-1.5 text-xs rounded-md border ${active === keyName ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{label}</button>
    );

    useEffect(() => {
        const loadTodaysTitles = async () => {
            try {
                const { data: authData } = await supabase.auth.getUser();
                const user = (authData as any)?.user;
                const today = new Date();
                const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
                const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
                let q = supabase.from('quote').select('id,title,created_at').gte('created_at', start).lt('created_at', next).order('created_at', { ascending: false });
                if (user?.id) q = q.eq('user_id', user.id);
                const { data } = await q;
                setTitlesToday(data || []);
            } catch { setTitlesToday([]); }
        };
        loadTodaysTitles();
    }, []);

    const onPickTitle = (id: string) => router.push(makeHref(active, id));
    const startNew = async () => {
        if (!titleInput.trim()) return alert('타이틀을 입력하세요');
        try {
            setCreating(true);
            const { data: authData, error: authErr } = await supabase.auth.getUser();
            if (authErr) return alert('로그인이 필요합니다.');
            const user = (authData as any)?.user;
            if (!user?.id) return alert('로그인이 필요합니다.');
            const resp = await supabase.from('quote').insert({ title: titleInput.trim(), status: 'draft', user_id: user.id }).select('id').single();
            if (resp.error || !resp.data?.id) return alert(`견적 생성 실패: ${resp.error?.message || '알 수 없는 오류'}`);
            router.push(makeHref(active, resp.data.id));
        } finally { setCreating(false); }
    };

    return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
                <Tab keyName="cruise" label="크루즈" />
                <Tab keyName="airport" label="공항" />
                <Tab keyName="hotel" label="호텔" />
                <Tab keyName="rentcar" label="렌트카" />
                <Tab keyName="tour" label="투어" />
            </div>
            <div className="flex items-center gap-2">
                <select onChange={(e) => e.target.value && onPickTitle(e.target.value)} className="border p-1.5 rounded text-xs bg-white max-w-[240px]">
                    <option value="">오늘 작성한 타이틀 선택</option>
                    {titlesToday.map(t => (
                        <option key={t.id} value={t.id}>{t.title} — {new Date(t.created_at).toLocaleTimeString()}</option>
                    ))}
                </select>
                <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="타이틀" className="border p-1.5 rounded text-xs" />
                <button
                    type="button"
                    onClick={startNew}
                    disabled={creating}
                    className="text-xs bg-green-600 text-white px-3 sm:px-4 py-2 rounded min-w-[96px] sm:min-w-[120px] text-center"
                    aria-label="작업 시작"
                >
                    {creating ? '생성중...' : '작업 시작'}
                </button>
            </div>
        </div>
    );
}

function HotelQuoteContentManager() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quoteId = searchParams.get('quoteId');
    const [quoteTitle, setQuoteTitle] = useState<string>('');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!quoteId) {
            alert('견적 ID가 필요합니다. 먼저 타이틀로 견적을 생성하세요.');
            router.push('/manager/quotes/cruise');
        }
    }, [quoteId, router]);

    useEffect(() => {
        const loadTitle = async () => {
            if (!quoteId) return;
            try {
                const { data } = await supabase.from('quote').select('title').eq('id', quoteId).single();
                if (data?.title) setQuoteTitle(data.title);
            } catch { }
        };
        loadTitle();
    }, [quoteId]);

    const onFormSuccess = () => setReloadKey((k) => k + 1);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2 -mt-2 -mb-2">
                <div className="text-xs text-gray-600">행복여행 이름: <span className="font-semibold text-gray-900">{quoteTitle || '-'}</span></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
                {quoteId ? (
                    <HotelFormLite quoteId={quoteId} onSuccess={onFormSuccess} />
                ) : (
                    <div className="text-sm text-gray-500 p-4">견적 ID가 필요합니다.</div>
                )}
            </div>
            <RightDetailsCard key={reloadKey} />
        </div>
    );
}

function RightDetailsCard() {
    const params = useSearchParams();
    const quoteId = params.get('quoteId');
    const [loading, setLoading] = useState(false);
    const [detailedServices, setDetailedServices] = useState<any>({ rooms: [], cars: [], airports: [], hotels: [], rentcars: [], tours: [] });
    const naturalRef = useRef<HTMLDivElement | null>(null);
    const naturalTextRef = useRef<HTMLDivElement | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number>(529); // 기본값 설정

    const copyNaturalOnly = async () => {
        const el = naturalTextRef.current || naturalRef.current;
        const text = el?.innerText || '';
        if (!text) return alert('복사할 자연어 요약이 없습니다.');
        await navigator.clipboard.writeText(text);
        alert('자연어 요약을 복사했습니다.');
    };

    // 환율 데이터 로드
    useEffect(() => {
        const loadExchangeRate = async () => {
            try {
                const rateData = await getExchangeRate('VND');
                if (rateData && rateData.rate_to_krw) {
                    setExchangeRate(rateData.rate_to_krw);
                }
            } catch (error) {
                console.error('환율 데이터 로드 실패:', error);
                // 실패 시 기본값 유지
            }
        };
        loadExchangeRate();
    }, []);

    useEffect(() => {
        const run = async () => {
            if (!quoteId) return;
            try {
                setLoading(true);
                const { data: items } = await supabase.from('quote_item').select('*').eq('quote_id', quoteId);
                const detailed: any = { rooms: [], cars: [], airports: [], hotels: [], rentcars: [], tours: [] };
                for (const item of (items || [])) {
                    try {
                        if (item.service_type === 'hotel') {
                            const { data: hotelInfo } = await supabase.from('hotel').select('*').eq('id', item.service_ref_id).single();
                            if (hotelInfo) {
                                const { data: priceInfo } = await supabase.from('hotel_price').select('*').eq('hotel_code', hotelInfo.hotel_code);
                                detailed.hotels.push({ item, hotelInfo, priceInfo: priceInfo || [] });
                            }
                        } else if (item.service_type === 'room') {
                            const { data: roomInfo } = await supabase.from('room').select('*').eq('id', item.service_ref_id).single();
                            if (roomInfo) {
                                const { data: priceInfo } = await supabase.from('room_price').select('*').eq('room_code', roomInfo.room_code);
                                detailed.rooms.push({ item, roomInfo, priceInfo: priceInfo || [] });
                            }
                        } else if (item.service_type === 'car') {
                            const { data: carInfo } = await supabase.from('car').select('*').eq('id', item.service_ref_id).single();
                            if (carInfo) {
                                const { data: priceInfo } = await supabase.from('car_price').select('*').eq('car_code', carInfo.car_code);
                                detailed.cars.push({ item, carInfo, priceInfo: priceInfo || [] });
                            }
                        } else if (item.service_type === 'airport') {
                            const { data: airportInfo } = await supabase.from('airport').select('*').eq('id', item.service_ref_id).single();
                            if (airportInfo) {
                                const { data: priceInfo } = await supabase.from('airport_price').select('*').eq('airport_code', airportInfo.airport_code);
                                detailed.airports.push({ item, airportInfo, priceInfo: priceInfo || [] });
                            }
                        } else if (item.service_type === 'rentcar') {
                            const { data: rentcarInfo } = await supabase.from('rentcar').select('*').eq('id', item.service_ref_id).single();
                            if (rentcarInfo) {
                                const { data: priceInfo } = await supabase.from('rent_price').select('*').eq('rent_code', rentcarInfo.rentcar_code);
                                detailed.rentcars.push({ item, rentcarInfo, priceInfo: priceInfo || [] });
                            }
                        } else if (item.service_type === 'tour') {
                            const { data: tourInfo } = await supabase.from('tour').select('*').eq('id', item.service_ref_id).single();
                            if (tourInfo) {
                                const { data: priceInfo } = await supabase.from('tour_price').select('*').eq('tour_code', tourInfo.tour_code);
                                detailed.tours.push({ item, tourInfo, priceInfo: priceInfo || [] });
                            }
                        }
                    } catch (ie) { console.warn('상세 로드 실패:', ie); }
                }
                setDetailedServices(detailed);
            } finally { setLoading(false); }
        };
        run();
    }, [quoteId]);

    const formatDong = (v?: number | null) => {
        if (!v) return '-';
        const man = Math.round(v / 10000);
        return `${man.toLocaleString()}만동`;
    };
    // 호텔 서비스의 총금액만 계산
    const hotelTotal = (detailedServices.hotels || []).reduce((s: number, h: any) => s + (h.item?.total_price || 0), 0);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-md font-semibold text-gray-800">안내</h3>
                <button type="button" onClick={copyNaturalOnly} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">자연어 복사</button>
            </div>

            <div ref={naturalRef} className="mt-2">
                <div ref={naturalTextRef} className="text-sm text-gray-700 whitespace-pre-wrap">
                    {(() => {
                        let out = '';
                        const EXCHANGE_RATE = exchangeRate;

                        out += `회원님~! 견적드립니다^^\n\n`;

                        // 호텔 서비스 표시
                        if (detailedServices.hotels?.length) {
                            detailedServices.hotels.forEach((h: any) => {
                                const p = h.priceInfo?.[0];
                                const unit = p?.price ?? p?.base_price ?? h.item?.unit_price ?? 0;
                                const cnt = h.item?.quantity ?? 1;
                                const tot = h.item?.total_price ?? (unit * cnt);

                                out += `호텔명: ${p?.hotel_name || ''}\n`;
                                out += `객실명: ${p?.room_name || ''}\n`;
                                out += `객실당 금액 1실 ${formatDong(unit)} * ${cnt}실 = ${formatDong(tot)}\n\n`;
                            });
                        }

                        out += `총금액: ${formatDong(hotelTotal)}\n`;
                        // 정확한 환율 계산: 동화 금액을 환율로 나누기
                        const won = roundKrwToHundred(vndToKrw(hotelTotal, EXCHANGE_RATE));
                        out += `원화금액: ${won.toLocaleString()}원\n\n`;
                        out += `해당 환율은 참고용 네이버 환율로, 실제 결제하시는 금액과 차이가 있을 수 있습니다.^^`;
                        return out;
                    })()}
                </div>
            </div>

            <div className="mt-4 border-t pt-3">
                <h5 className="text-sm font-medium text-gray-700 mb-2">상세 서비스 정보</h5>
                {loading ? (
                    <div className="text-xs text-gray-400">로딩 중...</div>
                ) : (
                    <div className="space-y-3 text-sm text-gray-700">
                        {detailedServices.hotels?.length > 0 && (
                            <div>
                                <h6 className="font-medium">🏨 호텔</h6>
                                <div className="space-y-2 mt-2">
                                    {detailedServices.hotels.map((h: any, i: number) => (
                                        <div key={i} className="p-2 border rounded bg-white">
                                            <div className="text-xs text-gray-600">기본 정보:</div>
                                            <div className="text-sm font-medium">{h.hotelInfo?.hotel_code ? `호텔 코드: ${h.hotelInfo.hotel_code}` : ''}</div>
                                            {h.priceInfo?.length > 0 && h.priceInfo.map((p: any, pi: number) => (
                                                <div key={pi} className="mt-1 p-2 bg-gray-50 rounded">
                                                    <div className="text-sm">{p.hotel_name ? `호텔명: ${p.hotel_name}` : ''} {p.room_name ? ` / 객실명: ${p.room_name}` : ''}</div>
                                                    <div className="text-sm">{p.room_type ? `객실 타입: ${p.room_type}` : ''}</div>
                                                    <div className="text-sm font-medium text-green-600">{p.price !== null && p.price !== undefined ? `기본 가격: ${p.price?.toLocaleString()}동` : ''} {p.base_price ? ` / 단가: ${p.base_price?.toLocaleString()}동` : ''}</div>
                                                    <div className="text-sm text-blue-600 mt-1">총액: {h.item?.total_price ? h.item.total_price?.toLocaleString() + '동' : (h.item?.unit_price ? (h.item.unit_price * (h.item.quantity || 1)).toLocaleString() + '동' : '-')}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ManagerHotelQuotePage() {
    return (
        <Suspense fallback={
            <ManagerLayout title="견적 입력" activeTab="quotes-cruise">
                <div className="flex flex-col justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">로딩 중...</p>
                </div>
            </ManagerLayout>
        }>
            <ManagerLayout title="견적 입력" activeTab="quotes-cruise">
                <ManagerServiceTabs active="hotel" />
                <HotelQuoteContentManager />
            </ManagerLayout>
        </Suspense>
    );
}
