'use client';
import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import { getExchangeRate, formatExchangeRate } from '../../../../lib/exchangeRate';
import { vndToKrw, roundKrwToHundred } from '../../../../lib/exchangeRate';
import { resolveLocalQuoteTitle, ensureQuoteTitle } from '../../../../lib/getQuoteTitle';

// 공용 탭 (quoteId 유지) + 오늘 타이틀 선택/작업 시작 컨트롤
function ManagerServiceTabs({ active }: { active: 'cruise' | 'airport' | 'hotel' | 'rentcar' | 'tour' | 'comprehensive' }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quoteId = searchParams.get('quoteId');
    const [titlesToday, setTitlesToday] = useState<any[]>([]);
    const [creating, setCreating] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const makeHref = (key: string, id?: string | null) => `/manager/quotes/${key}${id ? `?quoteId=${id}` : (quoteId ? `?quoteId=${quoteId}` : '')}`;
    const Tab = ({ keyName, label }: { keyName: typeof active; label: string }) => (
        <button
            type="button"
            onClick={() => router.push(makeHref(keyName))}
            className={`px-3 py-1.5 text-xs rounded-md border ${active === keyName ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
        >
            {label}
        </button>
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
            try { if (typeof window !== 'undefined') sessionStorage.removeItem('manager:cruise:form:draft'); } catch { }
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
                <Tab keyName="comprehensive" label="전체" />
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

function ManagerCruiseQuoteForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quoteId = searchParams.get('quoteId');

    const STORAGE_KEY = 'manager:cruise:form:draft';

    // 폼 상태 (마이페이지 크루즈 견적 입력과 동일 로직)
    const [form, setForm] = useState({
        checkin: new Date().toISOString().split('T')[0], // 오늘 날짜로 기본 설정
        schedule: '1박2일', // 1박2일로 기본 설정
        cruise_code: '',
        payment_code: '신용카드', // 신용카드로 기본 설정
        // rooms: array of groups -> categories use single extra_count
        rooms: [{ room_type: '', categories: [{ room_category: '', extra_count: 0, room_code: '' }] }]
    });

    const [vehicleForm, setVehicleForm] = useState([{ car_type: '', car_category: '', car_code: '', count: 1 }]);
    const [selectedCarCategory, setSelectedCarCategory] = useState('왕복'); // 왕복으로 기본 설정

    const [cruiseOptions, setCruiseOptions] = useState<string[]>([]);
    const [paymentOptions, setPaymentOptions] = useState<string[]>([]);
    const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
    const [roomCategoryOptions, setRoomCategoryOptions] = useState<string[]>([]);
    const [carCategoryOptions, setCarCategoryOptions] = useState<string[]>([]);
    const [carTypeOptions, setCarTypeOptions] = useState<string[]>([]);
    const scheduleOptions = ['1박2일', '2박3일', '당일'];
    const [formData, setFormData] = useState({ special_requests: '' });
    const [loading, setLoading] = useState(false);
    const [quote, setQuote] = useState<any>(null);
    const [quoteRooms, setQuoteRooms] = useState<any[]>([]);
    const [quoteCars, setQuoteCars] = useState<any[]>([]);
    const [detailedServices, setDetailedServices] = useState<any>({ rooms: [], cars: [], airports: [], hotels: [], rentcars: [], tours: [] });
    const rightCardRef = useRef<HTMLDivElement | null>(null);
    const naturalRef = useRef<HTMLDivElement | null>(null);
    const naturalTextRef = useRef<HTMLDivElement | null>(null);
    const [selectedDiscount, setSelectedDiscount] = useState<number | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number>(1400); // 기본 환율 설정
    const [rawExchangeRate, setRawExchangeRate] = useState<number | null>(null); // DB에 저장된 실제 원시 환율
    const [naturalSummary, setNaturalSummary] = useState<string>('');
    const [regenerating, setRegenerating] = useState<boolean>(false);
    const [isComparisonMode, setIsComparisonMode] = useState<boolean>(false);
    const [isCarComparisonMode, setIsCarComparisonMode] = useState<boolean>(false); // 차량 비교 모드
    // 합계 요약 상태: 동화 합계와 원화 합계
    const [totalSummary, setTotalSummary] = useState<{ totalDong: number; totalWon: number }>({ totalDong: 0, totalWon: 0 });

    const copyNaturalOnly = async () => {
        try {
            if (typeof window === 'undefined') return;
            const naturalEl = naturalTextRef.current || naturalRef.current;
            if (!naturalEl) {
                alert('복사할 자연어 요약 영역을 찾을 수 없습니다.');
                return;
            }
            // innerText of the text-only container (excludes header/button)
            const naturalText = naturalEl.innerText || '';
            if (!naturalText) {
                alert('복사할 자연어 요약이 없습니다.');
                return;
            }
            await navigator.clipboard.writeText(naturalText);
            alert('자연어 요약을 클립보드에 복사했습니다.');
        } catch (e) {
            console.error('복사 실패:', e);
            alert('복사에 실패했습니다. 브라우저의 클립보드 권한을 확인하세요.');
        }
    };
    const regenerateNatural = async () => {
        try {
            setRegenerating(true);
            const summary = generateNaturalSummary(detailedServices, exchangeRate, selectedDiscount, isComparisonMode, isCarComparisonMode);
            setNaturalSummary(summary);
        } catch (e) {
            console.error('자연어 생성 실패:', e);
            alert('자연어 생성에 실패했습니다. 콘솔을 확인하세요.');
        } finally {
            setRegenerating(false);
        }
    };
    // 자연어 요약 생성 함수
    const generateNaturalSummary = (services: any, rate: number, discount: number | null, comparisonMode: boolean = false, carComparisonMode: boolean = false) => {
        // 통화 포맷 헬퍼
        const formatDong = (v: number | null | undefined) => {
            if (v === null || v === undefined) return '-';
            const man = Math.round((v / 10000));
            return `${man.toLocaleString()}만동`;
        };

        // Normalize rate: some sources provide VND-per-KRW (e.g. 1400), others provide KRW-per-VND (small < 10).
        // We expect a multiplier for VND -> KRW. If rate looks large (>10), treat it as VND-per-KRW and invert it.
        const EXCHANGE_RATE = (typeof rate === 'number' && rate > 10) ? (1 / rate) : (rate || 0);

        // 차량 비교 모드: 차량을 하나씩 분리하여 따로 계산 (객실 포함)
        if (carComparisonMode) {
            let outCar = '';
            outCar += `회원님~! 차량별 견적드립니다^^\n\n`;

            // 크루즈별로 그룹화
            const cruiseCarGroups: { [key: string]: { cars: any[], rooms: any[] } } = {};

            // 차량 그룹화
            services.cars?.forEach((c: any) => {
                const cruiseName = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name || '크루즈 미지정';
                if (!cruiseCarGroups[cruiseName]) cruiseCarGroups[cruiseName] = { cars: [], rooms: [] };
                cruiseCarGroups[cruiseName].cars.push(c);
            });

            // 객실 그룹화
            services.rooms?.forEach((r: any) => {
                const cruiseName = r.roomInfo?.cruise_name || r.priceInfo?.[0]?.cruise || '크루즈 미지정';
                if (!cruiseCarGroups[cruiseName]) cruiseCarGroups[cruiseName] = { cars: [], rooms: [] };
                cruiseCarGroups[cruiseName].rooms.push(r);
            });

            // 객실 합계 계산 (공통)
            const calculateRoomTotal = (rooms: any[]) => {
                return rooms.reduce((sum: number, r: any) => {
                    const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                    const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                    let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                    const ri = r.roomInfo || {};
                    const catKey = String(categoryLabel || '').toLowerCase();
                    if (/엑스트라/.test(catKey)) {
                        categoryCount = ri.extra_count ?? categoryCount;
                    }
                    let roomTotal = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));
                    if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                        const discountRate = 1 - (Number(discount) / 100);
                        roomTotal = Math.round(roomTotal * discountRate);
                    }
                    return sum + roomTotal;
                }, 0);
            };

            // 크루즈별 합계를 저장할 배열 (비교용)
            const cruiseTotals: Array<{ cruiseName: string, roomTotal: number, carTotals: number[], combinedTotals: number[] }> = [];

            Object.entries(cruiseCarGroups).forEach(([cruiseName, data]) => {
                outCar += `크루즈: ${cruiseName}\n\n`;

                // 객실 합계 계산
                const roomTotal = calculateRoomTotal(data.rooms);

                // 객실 표시
                if (data.rooms && data.rooms.length > 0) {
                    data.rooms.forEach((r: any) => {
                        const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                        const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                        let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                        const ri = r.roomInfo || {};
                        const catKey = String(categoryLabel || '').toLowerCase();
                        if (/엑스트라/.test(catKey)) {
                            categoryCount = ri.extra_count ?? categoryCount;
                        }
                        let roomTotalPrice = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));

                        // 할인 적용
                        if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                            const discountRate = 1 - (Number(discount) / 100);
                            roomTotalPrice = Math.round(roomTotalPrice * discountRate);
                        }

                        const roomName = r.priceInfo?.[0]?.room_type || r.priceInfo?.[0]?.room_name || r.roomInfo?.room_name || '객실명 미지정';
                        outCar += `${roomName} ${categoryLabel} 1인 ${formatDong(unit)} * ${categoryCount}인 = ${formatDong(roomTotalPrice)}\n`;
                    });
                    outCar += `\n`;
                }

                // 각 차량별 합계 저장
                const carTotals: number[] = [];
                const combinedTotals: number[] = [];

                // 각 차량을 개별적으로 표시하고 합계 계산
                data.cars.forEach((c: any, idx: number) => {
                    const carName = c.priceInfo?.[0]?.car_type || c.carInfo?.car_type || '차량명 미지정';
                    const carCategory = c.priceInfo?.[0]?.car_category || c.carInfo?.car_category || '';
                    const unit = c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0;
                    const cnt = c.calculated_count ?? c.item?.quantity ?? 1;
                    const carTotal = c.calculated_total ?? (Number(unit || 0) * Number(cnt || 1));

                    carTotals.push(carTotal);
                    const combinedTotal = roomTotal + carTotal;
                    combinedTotals.push(combinedTotal);

                    const prefix = idx === 0 ? '차량: ' : '        ';
                    outCar += `${prefix}${carName}${carCategory ? ` (${carCategory})` : ''} 1인 ${formatDong(unit)} * ${cnt}인 = ${formatDong(carTotal)}\n`;
                });

                outCar += `\n`;

                // 각 차량별 합계 표시 (객실 + 차량N)
                data.cars.forEach((c: any, idx: number) => {
                    const carName = c.priceInfo?.[0]?.car_type || c.carInfo?.car_type || '차량명 미지정';
                    const combinedTotal = combinedTotals[idx];
                    const combinedTotalWon = roundKrwToHundred(vndToKrw(combinedTotal, EXCHANGE_RATE));
                    outCar += `객실 + 차량${idx + 1}(${carName}) 합계: ${formatDong(combinedTotal)} (원화: ${combinedTotalWon.toLocaleString()}원)\n`;
                });

                outCar += `\n`;

                cruiseTotals.push({ cruiseName, roomTotal, carTotals, combinedTotals });
            });

            // 차량 비교 (객실 + 각 차량별 합계)
            if (cruiseTotals.length > 0) {
                outCar += `=== 차량 비교 결과 ===\n\n`;

                cruiseTotals.forEach((cruise) => {
                    outCar += `${cruise.cruiseName}:\n`;
                    cruise.combinedTotals.forEach((total, idx) => {
                        const totalWon = roundKrwToHundred(vndToKrw(total, EXCHANGE_RATE));
                        outCar += `  객실 + 차량${idx + 1} 합계: ${formatDong(total)} (원화: ${totalWon.toLocaleString()}원)\n`;
                    });
                    outCar += `\n`;
                });

                // 차량별 차이 계산
                if (cruiseTotals[0]?.combinedTotals.length > 1) {
                    outCar += `차량 간 차이:\n`;
                    const maxCarCount = Math.max(...cruiseTotals.map(c => c.combinedTotals.length));

                    for (let carIdx = 0; carIdx < maxCarCount - 1; carIdx++) {
                        const totals = cruiseTotals.map(c => c.combinedTotals[carIdx]).filter(t => t !== undefined);
                        const nextTotals = cruiseTotals.map(c => c.combinedTotals[carIdx + 1]).filter(t => t !== undefined);

                        if (totals.length > 0 && nextTotals.length > 0) {
                            const diff = Math.abs(totals[0] - nextTotals[0]);
                            const diffWon = roundKrwToHundred(vndToKrw(diff, EXCHANGE_RATE));
                            outCar += `  차량${carIdx + 1} vs 차량${carIdx + 2}: ${formatDong(diff)} (원화: ${diffWon.toLocaleString()}원)\n`;
                        }
                    }
                    outCar += `\n`;
                }
            }

            outCar += `해당 환율은 참고용 네이버 환율로, 실제 결제하시는 금액과 차이가 있을 수 있습니다.^^`;

            return outCar;
        }

        // 비교 모드 전용 출력: 기존 요약을 포함하지 않고 요청하신 형식으로 한 번만 반환
        if (comparisonMode) {
            // 객실별 그룹화 (크루즈 + 객실명 단위)
            const roomGroups: { [key: string]: { cruiseName: string; roomName: string; rooms: any[]; total?: number } } = {};
            services.rooms?.forEach((r: any) => {
                const cruiseName = r.roomInfo?.cruise_name || r.priceInfo?.[0]?.cruise || '크루즈 미지정';
                const roomName = r.priceInfo?.[0]?.room_type || r.priceInfo?.[0]?.room_name || r.roomInfo?.room_name || '객실명 미지정';
                const key = `${cruiseName}_${roomName}`;
                if (!roomGroups[key]) roomGroups[key] = { cruiseName, roomName, rooms: [] };
                roomGroups[key].rooms.push(r);
            });

            // 각 그룹의 합계 계산
            Object.values(roomGroups).forEach((group) => {
                let groupTotal = 0;
                group.rooms.forEach((r: any) => {
                    const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                    let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                    const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                    const catKey = String(categoryLabel || '').toLowerCase();
                    const ri = r.roomInfo || {};
                    if (/엑스트라/.test(catKey)) categoryCount = ri.extra_count ?? categoryCount;
                    let roomTotal = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));
                    if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                        const discountRate = 1 - (Number(discount) / 100);
                        roomTotal = Math.round(roomTotal * discountRate);
                    }
                    groupTotal += roomTotal;
                });
                // 해당 크루즈의 차량 합계 추가
                services.cars?.forEach((c: any) => {
                    const carCruise = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name;
                    if (carCruise === group.cruiseName) {
                        const carTotal = c.calculated_total ?? (Number(c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0) * Number(c.calculated_count ?? c.item?.quantity ?? 1));
                        groupTotal += carTotal;
                    }
                });
                group.total = groupTotal;
            });

            // 크루즈별로 정리: cruiseName => [groups]
            const cruiseMap: { [key: string]: Array<{ roomName: string; rooms: any[]; total: number }> } = {};
            Object.values(roomGroups).forEach(g => {
                if (!cruiseMap[g.cruiseName]) cruiseMap[g.cruiseName] = [];
                cruiseMap[g.cruiseName].push({ roomName: g.roomName, rooms: g.rooms, total: g.total || 0 });
            });

            let outCmp = '';
            outCmp += `회원님~! 견적드립니다^^\n\n`;

            const cruiseNames = Object.keys(cruiseMap);
            cruiseNames.forEach((cruiseName, ci) => {
                outCmp += `크루즈: ${cruiseName}\n\n`;
                cruiseMap[cruiseName].forEach((rg) => {
                    outCmp += `객실명: ${rg.roomName}\n`;
                    // 객실 항목 상세
                    rg.rooms.forEach((r: any) => {
                        const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                        const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                        let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                        const ri = r.roomInfo || {};
                        const catKey = String(categoryLabel || '').toLowerCase();
                        if (/엑스트라/.test(catKey)) categoryCount = ri.extra_count ?? categoryCount;
                        let roomTotal = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));
                        if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                            const discountRate = 1 - (Number(discount) / 100);
                            roomTotal = Math.round(roomTotal * discountRate);
                        }
                        outCmp += `${categoryLabel} 1인 ${formatDong(unit)} * ${categoryCount}인 = ${formatDong(roomTotal)}\n`;
                    });

                    // 차량 (크루즈 소속 차량을 객실마다 중복 표기)
                    const groupCars = services.cars?.filter((c: any) => {
                        const carCruise = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name;
                        return carCruise === cruiseName;
                    }) || [];
                    if (groupCars.length > 0) {
                        groupCars.forEach((c: any, ci2: number) => {
                            const carName = c.priceInfo?.[0]?.car_type || c.carInfo?.car_type || '차량명 미지정';
                            const unit = c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0;
                            const cnt = c.calculated_count ?? c.item?.quantity ?? 1;
                            const total = c.calculated_total ?? (Number(unit || 0) * Number(cnt || 1));
                            const prefix = ci2 === 0 ? '차량: ' : '        ';
                            outCmp += `${prefix}${carName} 1인 ${formatDong(unit)} * ${cnt}인 = ${formatDong(total)}\n`;
                        });
                    }

                    const groupWon = roundKrwToHundred(vndToKrw(rg.total, EXCHANGE_RATE));
                    outCmp += `\n총합계: ${formatDong(rg.total)}\n`;
                    outCmp += `원화금액: ${groupWon.toLocaleString()}원\n\n`;
                });
            });

            // 비교 문구
            const sorted = Object.values(roomGroups).sort((a, b) => (a.total || 0) - (b.total || 0));
            if (sorted.length > 1) {
                const cheapest = sorted[0];
                const mostExpensive = sorted[sorted.length - 1];
                const diff = (mostExpensive.total || 0) - (cheapest.total || 0);
                const diffWon = roundKrwToHundred(vndToKrw(diff, EXCHANGE_RATE));
                outCmp += `${cheapest.cruiseName} ${cheapest.roomName} 객실과\n`;
                outCmp += `${mostExpensive.cruiseName} ${mostExpensive.roomName} 객실의\n차이는 ${formatDong(diff)}(원화: ${diffWon.toLocaleString()}원) 입니다.`;
                // 사용자 요청: 비교보기 하단 문구 추가
                outCmp += `\n\n해당 환율은 참고용 네이버 환율로, 실제 결제하시는 금액과 차이가 있을 수 있습니다.^^`;
            } else {
                outCmp += `비교할 수 있는 객실이 부족합니다.`;
            }

            return outCmp;
        }

        let out = '';
        const topCruise = services.rooms?.[0]?.roomInfo?.cruise_name || services.rooms?.[0]?.priceInfo?.[0]?.cruise || undefined;
        const hasServices = (services.rooms && services.rooms.length > 0) || (services.cars && services.cars.length > 0) || (services.airports && services.airports.length > 0) || (services.hotels && services.hotels.length > 0) || (services.rentcars && services.rentcars.length > 0) || (services.tours && services.tours.length > 0);
        if (hasServices) {
            out += `회원님~! 견적드립니다^^\n\n`;
        }
        const seenCruises = new Set<string>();
        // 객실 데이터를 크루즈별로 그룹화
        const cruiseGroups: { [key: string]: any[] } = {};
        services.rooms?.forEach((r: any) => {
            const cruiseName = r.roomInfo?.cruise_name || r.priceInfo?.[0]?.cruise || topCruise || '크루즈 미지정';
            if (!cruiseGroups[cruiseName]) {
                cruiseGroups[cruiseName] = [];
            }
            cruiseGroups[cruiseName].push(r);
        });

        // 크루즈별로 처리
        Object.entries(cruiseGroups).forEach(([cruiseName, rooms]) => {
            out += `크루즈: ${cruiseName}\n\n`;

            // 객실별로 그룹화
            const roomGroups: { [key: string]: any[] } = {};
            rooms.forEach((r: any) => {
                const roomName = r.priceInfo?.[0]?.room_type || r.priceInfo?.[0]?.room_name || r.roomInfo?.room_name || '객실명 미지정';
                if (!roomGroups[roomName]) {
                    roomGroups[roomName] = [];
                }
                roomGroups[roomName].push(r);
            });

            // 객실별로 처리
            let firstRoomInCruise = true;
            Object.entries(roomGroups).forEach(([roomName, roomItems]) => {
                if (!firstRoomInCruise) out += `\n`;
                out += `객실명: ${roomName}\n`;

                let roomTotalSum = 0;
                roomItems.forEach((r: any) => {
                    const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                    const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                    let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                    const ri = r.roomInfo || {};
                    const catKey = String(categoryLabel || '').toLowerCase();
                    if (/엑스트라/.test(catKey)) {
                        // DB에는 성인/아동 구분된 extra 컬럼이 없을 수 있으므로
                        // 저장된 단일 extra_count를 우선 사용합니다.
                        categoryCount = ri.extra_count ?? categoryCount;
                    }

                    let roomTotal = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));

                    // 할인 적용 - selectedDiscount 사용
                    if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                        const discountRate = 1 - (Number(discount) / 100);
                        roomTotal = Math.round(roomTotal * discountRate);
                    }

                    roomTotalSum += roomTotal;

                    out += `${categoryLabel} 1인 ${formatDong(unit)} * ${categoryCount}인 = ${formatDong(roomTotal)}\n`;
                });

                // 룸 테이블의 sale 컬럼 값에 따라 할인 표시 (첫 번째 객실 기준)
                if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                    out += `${discount}% 할인 바우쳐 적용시 금액: ${formatDong(roomTotalSum)}\n\n`;
                }

                firstRoomInCruise = false;
            });

            // 크루즈별 차량 표시
            // 객실 블록과 차량 블록 사이에 빈 줄을 추가
            if (Object.keys(roomGroups).length > 0) {
                out += `\n`;
            }
            const cruiseCars = services.cars?.filter((c: any) => {
                const carCruise = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name;
                return carCruise === cruiseName;
            }) || [];

            if (cruiseCars.length > 0) {
                cruiseCars.forEach((c: any, index: number) => {
                    const carName = c.priceInfo?.[0]?.car_type || c.carInfo?.car_type || '차량명 미지정';
                    const unit = c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0;
                    const cnt = c.calculated_count ?? c.item?.quantity ?? 1;
                    const total = c.calculated_total ?? (Number(unit || 0) * Number(cnt || 1));

                    const prefix = index === 0 ? '차량: ' : '        ';
                    out += `${prefix}${carName} 1인 ${formatDong(unit)} * ${cnt}인 = ${formatDong(total)}\n`;
                    // 차량 항목 사이에 한 줄 띄움
                    if (index < cruiseCars.length - 1) out += '\n';
                });
                out += '\n';
            }

            // 크루즈별 합계 계산 (객실 + 차량만)
            const cruiseRoomSum = rooms.reduce((s: number, r: any) => {
                const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                const ri = r.roomInfo || {};
                const catKey = String(categoryLabel || '').toLowerCase();
                if (/엑스트라/.test(catKey)) {
                    categoryCount = ri.extra_count ?? categoryCount;
                }
                let roomTotal = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));

                // 할인 적용 - selectedDiscount 사용
                if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                    const discountRate = 1 - (Number(discount) / 100);
                    roomTotal = Math.round(roomTotal * discountRate);
                }

                return s + roomTotal;
            }, 0);

            const cruiseCarSum = cruiseCars.reduce((s: number, c: any) => {
                const total = c.calculated_total ?? (Number(c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0) * Number(c.calculated_count ?? c.item?.quantity ?? 1));
                return s + total;
            }, 0);

            const cruiseTotal = cruiseRoomSum + cruiseCarSum;
            // 원화는 총합계에 환율(rate_to_krw)을 곱함 (정규화된 multiplier 사용)
            const cruiseWon = roundKrwToHundred(vndToKrw(cruiseTotal, EXCHANGE_RATE));

            out += `총합계: ${formatDong(cruiseTotal)}\n`;
            out += `원화금액: ${cruiseWon.toLocaleString()}원\n\n`;
        });

        // 크루즈 외 차량 표시 (크루즈에 속하지 않은 차량)
        const unassignedCars = services.cars?.filter((c: any) => {
            const carCruise = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name;
            return !carCruise || !Object.keys(cruiseGroups).includes(carCruise);
        }) || [];

        if (unassignedCars.length > 0) {
            unassignedCars.forEach((c: any, index: number) => {
                const carName = c.priceInfo?.[0]?.car_type || c.carInfo?.car_type || '차량명 미지정';
                const unit = c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0;
                const cnt = c.calculated_count ?? c.item?.quantity ?? 1;
                const total = c.calculated_total ?? (Number(unit || 0) * Number(cnt || 1));

                const prefix = index === 0 ? '차량: ' : '        ';
                out += `${prefix}${carName} 1인 ${formatDong(unit)} * ${cnt}인 = ${formatDong(total)}\n`;
                // 차량 항목 사이에 한 줄 띄움
                if (index < unassignedCars.length - 1) out += '\n';
            });
            out += '\n';
        }

        // 비교 모드일 때 가격 비교 결과 추가 (comprehensive 페이지와 동일한 로직)
        if (comparisonMode && services.rooms && services.rooms.length > 0) {
            // 객실별로 그룹화하여 각 객실의 총합 계산 (크루즈 + 객실명 단위)
            const roomGroups: { [key: string]: { cruiseName: string; roomName: string; total: number; rooms: any[] } } = {};

            services.rooms.forEach((r: any) => {
                const cruiseName = r.roomInfo?.cruise_name || r.priceInfo?.[0]?.cruise || '크루즈 미지정';
                const roomName = r.priceInfo?.[0]?.room_type || r.roomInfo?.room_name || '객실명 미지정';
                const key = `${cruiseName}_${roomName}`;

                if (!roomGroups[key]) {
                    roomGroups[key] = { cruiseName, roomName, total: 0, rooms: [] };
                }
                roomGroups[key].rooms.push(r);
            });

            // 각 객실 그룹의 총합 계산 (객실 합 + 해당 크루즈 차량 합)
            Object.values(roomGroups).forEach((group) => {
                let groupTotal = 0;
                group.rooms.forEach((r: any) => {
                    const categoryLabel = r.priceInfo?.[0]?.room_category || r.priceInfo?.[0]?.room_type || r.roomInfo?.room_category || '성인';
                    const unit = r.priceInfo?.[0]?.price ?? r.priceInfo?.[0]?.base_price ?? r.item?.unit_price ?? 0;
                    let categoryCount = r.calculated_count ?? r.item?.quantity ?? 1;
                    const ri = r.roomInfo || {};
                    const catKey = String(categoryLabel || '').toLowerCase();
                    if (/엑스트라/.test(catKey)) {
                        categoryCount = ri.extra_count ?? categoryCount;
                    }
                    let roomTotal = r.calculated_total ?? (Number(unit || 0) * Number(categoryCount || 1));

                    // 할인 적용
                    if (discount && [3, 5, 8, 10].includes(Number(discount))) {
                        const discountRate = 1 - (Number(discount) / 100);
                        roomTotal = Math.round(roomTotal * discountRate);
                    }

                    groupTotal += roomTotal;
                });

                // 차량 합계 추가 (해당 크루즈의 차량만)
                services.cars?.forEach((c: any) => {
                    const carCruise = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name;
                    if (carCruise === group.cruiseName) {
                        const carTotal = c.calculated_total ?? (Number(c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0) * Number(c.calculated_count ?? c.item?.quantity ?? 1));
                        groupTotal += carTotal;
                    }
                });

                group.total = groupTotal;
            });

            // 가격순으로 정렬
            const sortedRooms = Object.values(roomGroups).sort((a, b) => a.total - b.total);

            if (sortedRooms.length > 0) {
                // 각 객실 그룹별로 차량을 나열하고, VND 및 KRW 총합을 표시
                sortedRooms.forEach((grp, idx) => {
                    out += `\n${grp.cruiseName} — ${grp.roomName}\n`;

                    const groupCars = services.cars?.filter((c: any) => {
                        const carCruise = c.priceInfo?.[0]?.cruise || c.carInfo?.cruise_name;
                        return carCruise === grp.cruiseName;
                    }) || [];

                    if (groupCars.length > 0) {
                        groupCars.forEach((c: any, ci: number) => {
                            const carName = c.priceInfo?.[0]?.car_type || c.carInfo?.car_type || '차량명 미지정';
                            const unit = c.priceInfo?.[0]?.price ?? c.priceInfo?.[0]?.base_price ?? c.item?.unit_price ?? 0;
                            const cnt = c.calculated_count ?? c.item?.quantity ?? 1;
                            const total = c.calculated_total ?? (Number(unit || 0) * Number(cnt || 1));
                            const prefix = ci === 0 ? '차량: ' : '        ';
                            out += `${prefix}${carName} 1인 ${formatDong(unit)} * ${cnt}인 = ${formatDong(total)}\n`;
                            if (ci < groupCars.length - 1) out += '\n';
                        });
                    }

                    const groupWon = roundKrwToHundred(vndToKrw(grp.total, EXCHANGE_RATE));
                    out += `총합계: ${formatDong(grp.total)}\n`;
                    out += `원화금액: ${groupWon.toLocaleString()}원\n`;
                    if (idx < sortedRooms.length - 1) out += `\n`;
                });

                if (sortedRooms.length > 1) {
                    const cheapest = sortedRooms[0];
                    const mostExpensive = sortedRooms[sortedRooms.length - 1];
                    const priceDiff = mostExpensive.total - cheapest.total;
                    const diffWon = roundKrwToHundred(vndToKrw(priceDiff, EXCHANGE_RATE));
                    out += `\n비교결과: ${cheapest.cruiseName} ${cheapest.roomName} 객실과\n`;
                    out += `${mostExpensive.cruiseName} ${mostExpensive.roomName} 객실의\n차이는 ${formatDong(priceDiff)}(원화: ${diffWon.toLocaleString()}원) 입니다.\n`;
                }
            } else {
                out += `\n비교할 수 있는 객실이 부족합니다.\n`;
            }
        }

        // 문구는 요약의 맨 아래에 한 줄 띄워 표시
        out += `\n\n해당 환율은 참고용 네이버 환율로, 실제 결제하시는 금액과 차이가 있을 수 있습니다.^^`;

        return out;
    };
    // 합계 계산 useEffect
    useEffect(() => {
        if (!detailedServices.rooms && !detailedServices.cars && !detailedServices.airports && !detailedServices.hotels && !detailedServices.rentcars && !detailedServices.tours) {
            setTotalSummary({ totalDong: 0, totalWon: 0 });
            return;
        }

        const roomSum = detailedServices.rooms?.reduce((s: number, r: any) => {
            let val = r.calculated_total ?? (Number(r.calculated_unit || 0) * Number(r.calculated_count || 1));
            // 할인 적용 - selectedDiscount 사용
            if (selectedDiscount && [3, 5, 8, 10].includes(Number(selectedDiscount))) {
                const discountRate = 1 - (Number(selectedDiscount) / 100);
                val = Math.round(val * discountRate);
            }
            return s + (Number(val) || 0);
        }, 0) || 0;

        const carSum = detailedServices.cars?.reduce((s: number, c: any) => {
            const val = c.calculated_total ?? (Number(c.calculated_unit || 0) * Number(c.calculated_count || 1));
            return s + (Number(val) || 0);
        }, 0) || 0;

        const airportSum = detailedServices.airports?.reduce((s: number, a: any) => {
            const val = a.calculated_total ?? (Number(a.calculated_unit || 0) * Number(a.calculated_count || 1));
            return s + (Number(val) || 0);
        }, 0) || 0;

        const hotelSum = detailedServices.hotels?.reduce((s: number, h: any) => {
            const val = h.calculated_total ?? (Number(h.calculated_unit || 0) * Number(h.calculated_count || 1));
            return s + (Number(val) || 0);
        }, 0) || 0;

        const rentcarSum = detailedServices.rentcars?.reduce((s: number, rc: any) => {
            const val = rc.calculated_total ?? (Number(rc.calculated_unit || 0) * Number(rc.calculated_count || 1));
            return s + (Number(val) || 0);
        }, 0) || 0;

        const tourSum = detailedServices.tours?.reduce((s: number, t: any) => {
            const val = t.calculated_total ?? (Number(t.calculated_unit || 0) * Number(t.calculated_count || 1));
            return s + (Number(val) || 0);
        }, 0) || 0;

        const totalDong = roomSum + carSum + airportSum + hotelSum + rentcarSum + tourSum;
        // 원화는 총합계에 환율(rate_to_krw)을 곱함
        // Normalize exchangeRate similarly: if it looks like VND-per-KRW (e.g. 1400), invert it to get KRW-per-VND
        const multiplier = (typeof exchangeRate === 'number' && exchangeRate > 10) ? (1 / exchangeRate) : (exchangeRate || 0);
        const totalWon = Math.round(totalDong * multiplier);

        setTotalSummary({ totalDong, totalWon });
    }, [detailedServices, selectedDiscount, exchangeRate]);

    // 할인/환율/서비스/비교모드 변경 시 자연어 요약 자동 갱신
    useEffect(() => {
        try {
            const summary = generateNaturalSummary(detailedServices, exchangeRate, selectedDiscount, isComparisonMode, isCarComparisonMode);
            setNaturalSummary(summary);
        } catch (e) {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailedServices, exchangeRate, selectedDiscount, isComparisonMode, isCarComparisonMode]);

    // 복원: quoteId가 없을 때만 이전에 입력하던 임시값을 복원
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (quoteId) return; // 이미 견적이 있으면 복원하지 않음
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.form) setForm(parsed.form);
                if (parsed?.vehicleForm) setVehicleForm(parsed.vehicleForm);
                if (parsed?.formData) setFormData(parsed.formData);
            }
        } catch (e) {
            console.error('세션 복원 실패:', e);
        }
    }, [quoteId]);

    // API에서 정규화된 환율과 DB raw 값을 읽어와 UI에 표시 (디버깅용)
    useEffect(() => {
        let mounted = true;
        const loadRates = async () => {
            try {
                const er = await getExchangeRate('VND');
                if (!er) return;
                const norm = Number(er.rate_to_krw || 0);
                const raw = (er as any)?.raw_rate_to_krw ?? Number(er.rate_to_krw || 0);
                if (mounted) {
                    setExchangeRate(norm || 0);
                    setRawExchangeRate(raw !== undefined && raw !== null ? Number(raw) : null);
                }
            } catch (e) {
                // ignore
            }
        };
        loadRates();
        return () => { mounted = false; };
    }, []);

    // 저장: quoteId가 없는 상태에서 입력이 변경되면 세션에 임시 저장
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (quoteId) return; // quote가 생기면 더이상 autosave하지 않음
        try {
            const payload = { form, vehicleForm, formData };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            console.error('세션 저장 실패:', e);
        }
    }, [form, vehicleForm, formData, quoteId]);

    useEffect(() => {
        if (!quoteId) return; // 매니저 페이지에서는 빈 상태로도 표시되게 두고, 안내는 우측 카드에서 제공
        loadQuote();
    }, [quoteId]);

    const handleSelectTitle = async (id: string) => {
        try {
            console.log('handleSelectTitle start', id);
            const { data: items, error: itemsErr } = await supabase.from('quote_item').select('service_type,service_ref_id,quantity').eq('quote_id', id);
            console.log('quote_item result', items, itemsErr);
            if (itemsErr) throw itemsErr;

            const roomItems = (items || []).filter((it: any) => it.service_type === 'room');
            const carItems = (items || []).filter((it: any) => it.service_type === 'car');

            const rooms: any[] = [];
            const quoteRoomsForCard: any[] = [];
            for (const it of roomItems) {
                const { data: r, error: rErr } = await supabase.from('room').select('room_code,extra_count,person_count,single_charge_count').eq('id', it.service_ref_id).maybeSingle();
                if (rErr) {
                    console.log('room load failed for', it.service_ref_id, rErr);
                    continue;
                }
                // create categories for the labels; data uses single extra_count
                const categories = [
                    { room_category: '엑스트라', extra_count: (r?.extra_count) || 0, room_code: r?.room_code || '' }
                ];
                rooms.push({ room_type: r?.room_code || '', categories });
                // prepare card-friendly flat row (use person_count/extra fields available on room)
                const personCount = (r?.person_count) ?? ((r?.extra_count) ? r.extra_count : it.quantity || 1);
                quoteRoomsForCard.push({ room_code: r?.room_code || '', person_count: personCount, extra_count: (r?.extra_count) || 0, quantity: it.quantity || 1 });
            }

            const vehicles: any[] = [];
            for (const it of carItems) {
                const { data: c, error: cErr } = await supabase.from('car').select('car_code,car_count').eq('id', it.service_ref_id).single();
                if (cErr) {
                    console.log('car load failed for', it.service_ref_id, cErr);
                    continue;
                }
                vehicles.push({ car_type: c.car_code, car_category: '', car_code: c.car_code, count: c.car_count || it.quantity || 1 });
            }

            console.log('mapped rooms/vehicles', rooms, vehicles);

            // also load the quote meta (title/status) for display in the right card
            try {
                const { data: quoteData, error: quoteErr } = await supabase.from('quote').select('title,status,created_at').eq('id', id).single();
                if (!quoteErr && quoteData) setQuote(quoteData);
            } catch (qe) {
                console.log('quote load failed', qe);
            }

            // set quoteRooms/quoteCars for the right info card (flat rows)
            setQuoteRooms(quoteRoomsForCard.filter(r => r && Object.keys(r).length > 0));
            // vehicles -> flat car rows
            const quoteCarsForCard = vehicles.map(v => ({ car_code: v.car_code, car_count: v.count, quantity: v.count }));
            setQuoteCars(quoteCarsForCard.filter(c => c && Object.keys(c).length > 0));
            // load detailed service info for right card
            await loadRightDetails(id);
            // NOTE: do NOT populate left-side form when selecting a title here.
            // Only update right-side info card (quoteRooms, quoteCars) and quote meta.
        } catch (e) {
            console.error('타이틀 선택 에러:', e);
            alert('타이틀 로드 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        } finally { }
    };

    useEffect(() => {
        if (form.schedule && form.checkin) {
            loadCruiseOptions();
        } else {
            setCruiseOptions([]);
            setForm(prev => ({ ...prev, cruise_code: '' }));
        }
    }, [form.schedule, form.checkin]);

    useEffect(() => {
        if (form.schedule && form.checkin && form.cruise_code) {
            loadPaymentOptions();
            loadCarCategoryOptions();
        } else {
            setPaymentOptions([]);
            setCarCategoryOptions([]);
            setForm(prev => ({ ...prev, payment_code: '' }));
        }
    }, [form.schedule, form.checkin, form.cruise_code]);

    useEffect(() => {
        if (form.schedule && form.checkin && form.cruise_code && form.payment_code) {
            loadRoomTypeOptions();
        } else {
            setRoomTypeOptions([]);
        }
    }, [form.schedule, form.checkin, form.cruise_code, form.payment_code]);

    useEffect(() => {
        if (selectedCarCategory && form.schedule && form.cruise_code) {
            loadCarTypeOptions();
        } else {
            setCarTypeOptions([]);
        }
    }, [selectedCarCategory, form.schedule, form.cruise_code]);

    const loadQuote = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('quote')
                .select('title, status, created_at')
                .eq('id', quoteId)
                .single();
            if (error) throw error;
            setQuote(data);
            // load quote items -> rooms and cars
            try {
                const { data: items, error: itemsErr } = await supabase.from('quote_item').select('service_type,service_ref_id,quantity').eq('quote_id', quoteId);
                if (itemsErr) throw itemsErr;
                const roomItems = (items || []).filter((it: any) => it.service_type === 'room');
                const carItems = (items || []).filter((it: any) => it.service_type === 'car');

                const roomPromises = roomItems.map((it: any) => supabase.from('room').select('room_code,extra_count,person_count,single_charge_count').eq('id', it.service_ref_id).maybeSingle());
                const carPromises = carItems.map((it: any) => supabase.from('car').select('car_code,car_count').eq('id', it.service_ref_id).single());

                const roomResults = await Promise.all(roomPromises);
                const carResults = await Promise.all(carPromises);

                const rooms = roomResults.map((r: any, i: number) => ({ ...(r.data || {}), quantity: roomItems[i]?.quantity }));
                const cars = carResults.map((r: any, i: number) => ({ ...(r.data || {}), quantity: carItems[i]?.quantity }));

                setQuoteRooms(rooms.filter(r => r && Object.keys(r).length > 0));
                setQuoteCars(cars.filter(c => c && Object.keys(c).length > 0));
                // load detailed info for right card
                await loadRightDetails(quoteId as string);
            } catch (ie) {
                console.error('quote items load failed:', ie);
                setQuoteRooms([]);
                setQuoteCars([]);
            }
        } catch (e) {
            console.error('견적 조회 실패:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadRightDetails = async (qid: string | null) => {
        if (!qid) return;
        try {
            const { data: items, error } = await supabase.from('quote_item').select('*').eq('quote_id', qid);
            if (error) throw error;

            const detailed: any = { rooms: [], cars: [], airports: [], hotels: [], rentcars: [], tours: [] };

            for (const item of (items || [])) {
                try {
                    if (item.service_type === 'room') {
                        const { data: roomData } = await supabase.from('room').select('*').eq('id', item.service_ref_id).single();
                        if (roomData) {
                            const { data: priceData } = await supabase.from('room_price').select('*').eq('room_code', roomData.room_code);
                            // 계산: 기본가격 * 인원수 (카테고리별로 정확하게 계산)
                            const unit = (priceData && priceData[0] && (priceData[0].price ?? priceData[0].base_price)) ?? item.unit_price ?? 0;
                            // 카테고리별 인원수 우선 사용, 없으면 합산
                            const extraCount = roomData.extra_count ?? 0;
                            const personCount = extraCount > 0 ? extraCount : (roomData.person_count ?? item.quantity ?? 1);
                            const calcTotal = Number(unit || 0) * Number(personCount || 1);
                            detailed.rooms.push({ item, roomInfo: roomData, priceInfo: priceData || [], calculated_unit: unit, calculated_count: personCount, calculated_total: calcTotal });
                        }
                    } else if (item.service_type === 'car') {
                        const { data: carData } = await supabase.from('car').select('*').eq('id', item.service_ref_id).single();
                        if (carData) {
                            const { data: priceData } = await supabase.from('car_price').select('*').eq('car_code', carData.car_code);
                            const unit = (priceData && priceData[0] && (priceData[0].price ?? priceData[0].base_price)) ?? item.unit_price ?? 0;
                            const count = item.quantity ?? carData.car_count ?? 1;
                            const calcTotal = Number(unit || 0) * Number(count || 1);
                            detailed.cars.push({ item, carInfo: carData, priceInfo: priceData || [], calculated_unit: unit, calculated_count: count, calculated_total: calcTotal });
                        }
                    } else if (item.service_type === 'airport') {
                        const { data: apData } = await supabase.from('airport').select('*').eq('id', item.service_ref_id).single();
                        if (apData) {
                            const { data: priceData } = await supabase.from('airport_price').select('*').eq('airport_code', apData.airport_code);
                            const unit = (priceData && priceData[0] && (priceData[0].price ?? priceData[0].base_price)) ?? item.unit_price ?? 0;
                            const count = item.quantity ?? apData.person_count ?? 1;
                            const calcTotal = Number(unit || 0) * Number(count || 1);
                            detailed.airports.push({ item, airportInfo: apData, priceInfo: priceData || [], calculated_unit: unit, calculated_count: count, calculated_total: calcTotal });
                        }
                    } else if (item.service_type === 'hotel') {
                        const { data: hotelData } = await supabase.from('hotel').select('*').eq('id', item.service_ref_id).single();
                        if (hotelData) {
                            const { data: priceData } = await supabase.from('hotel_price').select('*').eq('hotel_code', hotelData.hotel_code);
                            const unit = (priceData && priceData[0] && (priceData[0].price ?? priceData[0].base_price)) ?? item.unit_price ?? 0;
                            const count = item.quantity ?? hotelData.guests ?? 1;
                            const calcTotal = Number(unit || 0) * Number(count || 1);
                            detailed.hotels.push({ item, hotelInfo: hotelData, priceInfo: priceData || [], calculated_unit: unit, calculated_count: count, calculated_total: calcTotal });
                        }
                    } else if (item.service_type === 'rentcar') {
                        const { data: rentData } = await supabase.from('rentcar').select('*').eq('id', item.service_ref_id).single();
                        if (rentData) {
                            const { data: priceData } = await supabase.from('rent_price').select('*').eq('rent_code', rentData.rentcar_code);
                            const unit = (priceData && priceData[0] && (priceData[0].price ?? priceData[0].base_price)) ?? item.unit_price ?? 0;
                            const count = item.quantity ?? rentData.rental_days ?? 1;
                            const calcTotal = Number(unit || 0) * Number(count || 1);
                            detailed.rentcars.push({ item, rentcarInfo: rentData, priceInfo: priceData || [], calculated_unit: unit, calculated_count: count, calculated_total: calcTotal });
                        }
                    } else if (item.service_type === 'tour') {
                        const { data: tourData } = await supabase.from('tour').select('*').eq('id', item.service_ref_id).single();
                        if (tourData) {
                            const { data: priceData } = await supabase.from('tour_price').select('*').eq('tour_code', tourData.tour_code);
                            const unit = (priceData && priceData[0] && (priceData[0].price ?? priceData[0].base_price)) ?? item.unit_price ?? 0;
                            const count = item.quantity ?? tourData.participant_count ?? 1;
                            const calcTotal = Number(unit || 0) * Number(count || 1);
                            detailed.tours.push({ item, tourInfo: tourData, priceInfo: priceData || [], calculated_unit: unit, calculated_count: count, calculated_total: calcTotal });
                        }
                    }
                } catch (innerErr) {
                    console.warn('서비스 상세 로드 실패:', innerErr);
                }
            }

            setDetailedServices(detailed);
            return detailed;
        } catch (e) {
            console.error('우측 상세 정보 로드 실패:', e);
            setDetailedServices({ rooms: [], cars: [], airports: [], hotels: [], rentcars: [], tours: [] });
            return null;
        }
    };

    const loadCruiseOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('room_price')
                .select('cruise')
                .eq('schedule', form.schedule)
                .lte('start_date', form.checkin)
                .gte('end_date', form.checkin)
                .order('cruise');
            if (error) throw error;
            const unique = [...new Set((data || []).map((d: any) => d.cruise).filter(Boolean))] as string[];
            setCruiseOptions(unique);
        } catch (e) {
            console.error('크루즈 옵션 조회 실패:', e);
        }
    };

    const loadPaymentOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('room_price')
                .select('payment')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .lte('start_date', form.checkin)
                .gte('end_date', form.checkin)
                .order('payment');
            if (error) throw error;
            const unique = [...new Set((data || []).map((d: any) => d.payment).filter(Boolean))] as string[];
            setPaymentOptions(unique);
        } catch (e) {
            console.error('결제방식 옵션 조회 실패:', e);
        }
    };

    const loadRoomTypeOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('room_price')
                .select('room_type')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .eq('payment', form.payment_code)
                .lte('start_date', form.checkin)
                .gte('end_date', form.checkin)
                .order('room_type');
            if (error) throw error;
            const unique = [...new Set((data || []).map((d: any) => d.room_type).filter(Boolean))] as string[];
            setRoomTypeOptions(unique);
        } catch (e) {
            console.error('객실타입 옵션 조회 실패:', e);
        }
    };

    const loadRoomCategoryOptions = async (roomType?: string) => {
        try {
            const { data, error } = await supabase
                .from('room_price')
                .select('room_category')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .eq('payment', form.payment_code)
                .eq('room_type', roomType || '')
                .lte('start_date', form.checkin)
                .gte('end_date', form.checkin)
                .order('room_category');
            if (error) throw error;
            const unique = [...new Set((data || []).map((d: any) => d.room_category).filter(Boolean))] as string[];
            setRoomCategoryOptions(unique);
        } catch (e) {
            console.error('룸카테고리 옵션 조회 실패:', e);
        }
    };

    const loadCarCategoryOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('car_price')
                .select('car_category')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .order('car_category');
            if (error) throw error;
            const unique = [...new Set((data || []).map((d: any) => d.car_category).filter(Boolean))] as string[];
            setCarCategoryOptions(unique);
        } catch (e) {
            console.error('차량 카테고리 옵션 조회 실패:', e);
        }
    };

    const loadCarTypeOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('car_price')
                .select('car_type')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .eq('car_category', selectedCarCategory)
                .order('car_type');
            if (error) throw error;
            const unique = [...new Set((data || []).map((d: any) => d.car_type).filter(Boolean))] as string[];
            setCarTypeOptions(unique);
        } catch (e) {
            console.error('차량타입 옵션 조회 실패:', e);
        }
    };

    const getRoomCode = async (roomType: string, roomCategory: string): Promise<string> => {
        try {
            const { data, error } = await supabase
                .from('room_price')
                .select('room_code')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .eq('payment', form.payment_code)
                .eq('room_type', roomType)
                .eq('room_category', roomCategory)
                .lte('start_date', form.checkin)
                .gte('end_date', form.checkin)
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data?.room_code || '';
        } catch (e) {
            console.error('room_code 조회 실패:', e);
            return '';
        }
    };

    const getCarCode = async (carType: string, carCategory: string): Promise<string> => {
        try {
            const { data, error } = await supabase
                .from('car_price')
                .select('car_code')
                .eq('schedule', form.schedule)
                .eq('cruise', form.cruise_code)
                .eq('car_type', carType)
                .eq('car_category', carCategory)
                .limit(1)
                .single();
            if (error) throw error;
            return data.car_code;
        } catch (e) {
            console.error('car_code 조회 실패:', e);
            return '';
        }
    };

    const addNewRoom = () => {
        if (form.rooms.length < 3) {
            setForm(prev => ({
                ...prev,
                rooms: [...prev.rooms, { room_type: '', categories: [{ room_category: '', extra_count: 0, room_code: '' }] }]
            }));
        }
    };

    const addNewCategory = (roomIndex: number) => {
        setForm(prev => {
            const newRooms = [...prev.rooms];
            newRooms[roomIndex].categories.push({ room_category: '', extra_count: 0, room_code: '' });
            return { ...prev, rooms: newRooms };
        });
    };

    const removeCategory = (roomIndex: number, categoryIndex: number) => {
        setForm(prev => {
            const newRooms = [...prev.rooms];
            newRooms[roomIndex].categories = newRooms[roomIndex].categories.filter((_, i) => i !== categoryIndex);
            return { ...prev, rooms: newRooms };
        });
    };

    const handleAddVehicle = () => {
        if (vehicleForm.length < 3) {
            setVehicleForm([...vehicleForm, { car_type: '', car_category: '', car_code: '', count: 1 }]);
        }
    };

    const handleRemoveVehicle = (index: number) => {
        if (vehicleForm.length > 1) {
            setVehicleForm(vehicleForm.filter((_, i) => i !== index));
        }
    };

    const handleVehicleChange = (index: number, field: string, value: any) => {
        const next = [...vehicleForm];
        (next[index] as any)[field] = value;
        setVehicleForm(next);
    };

    const setCategoryCount = (roomIndex: number, roomCategory: string, field: 'extra_count', value: number) => {
        setForm(prev => {
            const newRooms = [...prev.rooms];
            const room = newRooms[roomIndex];
            if (!room) return prev;
            let cat = room.categories.find((c: any) => c.room_category === roomCategory);
            if (!cat) {
                cat = { room_category: roomCategory, extra_count: 0, room_code: '' };
                room.categories.push(cat);
            }
            (cat as any)[field] = value;
            return { ...prev, rooms: newRooms };
        });

        // 엑스트라 클릭 메시지창 제거됨

        // 비동기로 room_code가 필요하면 조회하여 채움
        (async () => {
            if (value > 0) {
                const { rooms } = form;
                const room = rooms[roomIndex];
                if (room && !room.categories.find((c: any) => c.room_category === roomCategory)?.room_code) {
                    const roomCode = await getRoomCode(room.room_type, roomCategory);
                    if (roomCode) {
                        setForm(prev => {
                            const newRooms = [...prev.rooms];
                            const r = newRooms[roomIndex];
                            const cobj = r.categories.find((c: any) => c.room_category === roomCategory);
                            if (cobj) cobj.room_code = roomCode;
                            return { ...prev, rooms: newRooms };
                        });
                    }
                }
            }
        })();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            if (!quoteId) {
                alert('quoteId 쿼리 파라미터가 필요합니다. (예: ?quoteId=UUID)');
                return;
            }
            // Prevent duplicate inserts for same room_code / car_code by caching created IDs
            const roomIdByCode = new Map<string, any>();
            const carIdByCode = new Map<string, any>();
            // 객실 저장
            for (const room of form.rooms) {
                // find category objects by label
                const findCat = (label: string) => (room.categories || []).find((c: any) => c.room_category === label);
                const adultCat = findCat('성인');
                const childCat = findCat('아동');
                const singleCat = findCat('싱글차지');
                const extraCat = findCat('엑스트라');

                // Helper to insert a room row
                const insertRoomRow = async (catObj: any, personCount: number, extraCount = 0) => {
                    if (!catObj || !catObj.room_code || personCount <= 0) return;
                    // reuse existing room id if we already inserted this room_code
                    const code = String(catObj.room_code);
                    let roomId = roomIdByCode.get(code);
                    if (!roomId) {
                        const { data: roomData, error: roomError } = await supabase
                            .from('room')
                            .insert({
                                room_code: catObj.room_code,
                                person_count: personCount,
                                extra_count: extraCount,
                                sale: selectedDiscount
                            })
                            .select()
                            .maybeSingle();
                        if (roomError) throw roomError;
                        roomId = roomData?.id;
                        if (roomId) roomIdByCode.set(code, roomId);
                    }
                    if (!roomId) return;
                    const { error: itemError } = await supabase
                        .from('quote_item')
                        .insert({
                            quote_id: quoteId,
                            service_type: 'room',
                            service_ref_id: roomId,
                            quantity: 1,
                            unit_price: 0,
                            total_price: 0
                        });
                    if (itemError) throw itemError;
                };

                // Insert main categories individually
                const adultCount = adultCat ? (adultCat.extra_count ?? 0) : 0;
                const childCount = childCat ? (childCat.extra_count ?? 0) : 0;
                const singleCount = singleCat ? (singleCat.extra_count ?? 0) : 0;

                await insertRoomRow(adultCat, adultCount, 0);
                await insertRoomRow(childCat, childCount, 0);
                await insertRoomRow(singleCat, singleCount, 0);

                // Aggregate extras into a single '엑스트라' row if any (all extras stored as extra_count)
                const totalExtras = extraCat ? (extraCat.extra_count ?? 0) : 0;
                const extraRoomObj = extraCat || singleCat || adultCat || childCat;
                if (totalExtras > 0 && extraRoomObj) {
                    await insertRoomRow(extraRoomObj, totalExtras, totalExtras);
                }
            }
            // 차량 저장
            for (const vehicle of vehicleForm) {
                if (vehicle.car_code && vehicle.count > 0) {
                    const code = String(vehicle.car_code);
                    let carId = carIdByCode.get(code);
                    if (!carId) {
                        const { data: carData, error: carError } = await supabase
                            .from('car')
                            .insert({ car_code: vehicle.car_code, car_count: vehicle.count })
                            .select()
                            .single();
                        if (carError) throw carError;
                        carId = carData?.id;
                        if (carId) carIdByCode.set(code, carId);
                    }
                    if (!carId) continue;

                    // 차량 단가 조회: car_price에서 우선 조회, 없으면 0으로 처리
                    let unitPrice = 0;
                    try {
                        const { data: priceRow } = await supabase
                            .from('car_price')
                            .select('price')
                            .eq('car_code', vehicle.car_code)
                            .maybeSingle();
                        if (priceRow && priceRow.price != null) unitPrice = Number(priceRow.price) || 0;
                    } catch (pe) {
                        console.warn('car price lookup failed', pe);
                    }

                    const totalPrice = unitPrice * (vehicle.count || 1);

                    const { error: itemError } = await supabase
                        .from('quote_item')
                        .insert({
                            quote_id: quoteId,
                            service_type: 'car',
                            service_ref_id: carId,
                            quantity: vehicle.count,
                            unit_price: unitPrice,
                            total_price: totalPrice
                        });
                    if (itemError) throw itemError;
                }
            }
            // 우측 상세 정보를 즉시 갱신하고 자연어 요약 재생성
            try {
                const detailed = await loadRightDetails(quoteId as string);
                const summary = generateNaturalSummary(detailed || detailedServices, exchangeRate, selectedDiscount, isComparisonMode, isCarComparisonMode);
                setNaturalSummary(summary);
            } catch (e) {
                console.warn('저장 후 상세 갱신 실패:', e);
            }

            alert('크루즈 견적이 저장되었습니다.');
        } catch (e) {
            console.error('저장 실패:', e);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 상단 간단 타이틀 스트립 (매니저 전용) */}
            <div className="lg:col-span-2 -mt-2 -mb-2">
                <div className="text-xs text-gray-600">행복여행 이름: <span className="font-semibold text-gray-900">{resolveLocalQuoteTitle(quote) ?? quote?.title ?? '로딩 중...'}</span></div>
            </div>
            {/* 좌측: 입력 카드 (2칸 차지) */}
            <div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">크루즈 견적</h2>
                        {/* 할인 버튼들 */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">할인:</span>
                            {[3, 5, 8, 10].map(discount => (
                                <button
                                    key={discount}
                                    type="button"
                                    onClick={() => setSelectedDiscount(discount)}
                                    className={`px-3 py-1 text-xs rounded border ${selectedDiscount === discount
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                                        }`}
                                >
                                    {discount}%
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setSelectedDiscount(null)}
                                className={`px-3 py-1 text-xs rounded border ${selectedDiscount === null
                                    ? 'bg-gray-500 text-white border-gray-500'
                                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                                    }`}
                            >
                                해제
                            </button>
                        </div>
                    </div>

                    {/* 간단 안내 카드 */}
                    <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-100">
                        <div className="text-sm text-blue-800">
                            날짜와 일정 → 크루즈 → 결제 → 객실/차량 순서로 선택하세요.
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">체크인 날짜</label>
                            <input
                                type="date"
                                value={form.checkin}
                                onChange={e => setForm({ ...form, checkin: e.target.value })}
                                className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">일정</label>
                            <div className="flex flex-wrap gap-2">
                                {scheduleOptions.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setForm({ ...form, schedule: opt })}
                                        className={`px-3 py-2 rounded-md border text-sm ${form.schedule === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">크루즈</label>
                            <select
                                value={form.cruise_code}
                                onChange={e => setForm({ ...form, cruise_code: e.target.value })}
                                className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">선택</option>
                                {cruiseOptions.map(cruise => (
                                    <option key={cruise} value={cruise}>{cruise}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">결제 방식</label>
                            <div className="flex flex-wrap gap-2">
                                {paymentOptions.map(pay => (
                                    <button
                                        key={pay}
                                        type="button"
                                        onClick={() => setForm({ ...form, payment_code: pay })}
                                        className={`px-3 py-2 rounded-md border text-sm ${form.payment_code === pay ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                    >
                                        {pay}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 객실 */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-md font-semibold text-gray-800">객실 선택</h3>
                            </div>
                            {form.rooms.map((room, roomIdx) => (
                                <div key={roomIdx} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">

                                        {form.rooms.length > 1 && (
                                            <button type="button" className="text-xs text-red-600" onClick={() => setForm(prev => ({ ...prev, rooms: prev.rooms.filter((_, i) => i !== roomIdx) }))}>삭제</button>
                                        )}
                                    </div>
                                    <div className="mb-2">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">객실 타입</label>
                                        <select
                                            value={room.room_type}
                                            onChange={e => {
                                                const newRooms = [...form.rooms];
                                                newRooms[roomIdx].room_type = e.target.value;
                                                newRooms[roomIdx].categories = [{ room_category: '', extra_count: 0, room_code: '' }];
                                                setForm({ ...form, rooms: newRooms });
                                                if (e.target.value) loadRoomCategoryOptions(e.target.value);
                                            }}
                                            className="w-full border border-gray-300 p-2 rounded-md"
                                        >
                                            <option value="">선택</option>
                                            {roomTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                                        </select>
                                    </div>
                                    {/* 카테고리 행을 하나씩 보여주기: 성인/아동/싱글차지/엑스트라 */}
                                    {['성인', '아동', '싱글차지', '엑스트라'].map((label, idx) => {
                                        const fieldMap: any = {
                                            '성인': 'extra_count',
                                            '아동': 'extra_count',
                                            '싱글차지': 'extra_count',
                                            '엑스트라': 'extra_count'
                                        };
                                        const field = fieldMap[label];
                                        const existing = room.categories.find((c: any) => c.room_category === label) || { room_category: label, extra_count: 0, room_code: '' };
                                        const currentVal: number = (existing as any)[field] || 0;
                                        return (
                                            <div key={idx} className="flex items-center justify-between border rounded-md p-2 mb-2">
                                                <div className="font-medium">{label}</div>
                                                <div className="flex flex-wrap gap-1 sm:gap-2">
                                                    {Array.from({ length: 11 }).map((_, n) => (
                                                        <button
                                                            key={n}
                                                            type="button"
                                                            onClick={() => setCategoryCount(roomIdx, label, field, n)}
                                                            className={`px-2 py-1 text-xs rounded sm:px-3 sm:py-2 sm:text-sm ${currentVal === n ? 'bg-blue-500 text-white' : 'bg-gray-50 border border-gray-200'}`}
                                                        >{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            {form.rooms.length < 3 && (
                                <button type="button" onClick={addNewRoom} className="w-full border-2 border-dashed rounded-md p-3 text-sm text-blue-600 border-blue-200">+ 객실 추가</button>
                            )}
                        </div>

                        {/* 차량 */}
                        <div className="space-y-3">
                            <h3 className="text-md font-semibold text-gray-800">차량 선택</h3>
                            <div>

                                <div className="flex flex-wrap gap-2">
                                    {carCategoryOptions.map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedCarCategory(cat)}
                                            className={`px-3 py-2 rounded-md border text-sm ${selectedCarCategory === cat ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {vehicleForm.map((vehicle, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">차량 {idx + 1}</span>
                                        {vehicleForm.length > 1 && (
                                            <button type="button" className="text-xs text-red-600" onClick={() => handleRemoveVehicle(idx)}>삭제</button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div>

                                            <input value={selectedCarCategory} readOnly className="w-full border p-2 rounded-md bg-gray-100 text-gray-700" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">차량타입</label>
                                            <select
                                                value={vehicle.car_type}
                                                onChange={async (e) => {
                                                    const carType = e.target.value;
                                                    const carCode = await getCarCode(carType, selectedCarCategory);
                                                    handleVehicleChange(idx, 'car_type', carType);
                                                    handleVehicleChange(idx, 'car_category', selectedCarCategory);
                                                    handleVehicleChange(idx, 'car_code', carCode);
                                                }}
                                                className="w-full border p-2 rounded-md"
                                            >
                                                <option value="">선택</option>
                                                {carTypeOptions.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">차량수</label>
                                            <input type="number" min={1} value={vehicle.count} onChange={(e) => handleVehicleChange(idx, 'count', parseInt(e.target.value) || 1)} className="w-full border p-2 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {vehicleForm.length < 3 && (
                                <button type="button" onClick={handleAddVehicle} className="w-full border-2 border-dashed rounded-md p-3 text-sm text-green-600 border-green-200">+ 차량 추가</button>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">특별 요청사항</label>
                            <textarea
                                value={formData.special_requests}
                                onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                                rows={3}
                                className="w-full border p-2 rounded-md"
                                placeholder="요청사항을 입력하세요"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => router.push('/manager/quotes')} className="px-4 py-2 border rounded-md">취소</button>
                            <button type="submit" disabled={loading} className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50">{loading ? '저장 중...' : '견적 추가'}</button>
                        </div>
                    </form>

                    {/* debug output removed per request */}
                </div>
            </div>

            {/* 우측: 안내 카드 */}
            <div>
                <div ref={rightCardRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-2">안내</h3>
                    {/* 자연어 요약 카드 (안내 상단) */}
                    <div ref={naturalRef} className="mt-4 border-t pt-3 bg-white p-3 rounded">
                        <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">자연어 요약</h5>
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={copyNaturalOnly} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">자연어 복사</button>
                                <button type="button" onClick={regenerateNatural} disabled={regenerating} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                                    {regenerating ? '생성중...' : '자연어 생성'}
                                </button>
                                <button type="button" onClick={() => setIsComparisonMode(!isComparisonMode)} className={`text-xs px-2 py-1 rounded ${isComparisonMode ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                                    {isComparisonMode ? '비교 해제' : '비교 보기'}
                                </button>
                                <button type="button" onClick={() => setIsCarComparisonMode(!isCarComparisonMode)} className={`text-xs px-2 py-1 rounded ${isCarComparisonMode ? 'bg-purple-500 text-white' : 'bg-indigo-500 text-white'}`}>
                                    {isCarComparisonMode ? '차량비교 해제' : '차량비교'}
                                </button>
                            </div>
                        </div>
                        {/* 텍스트 전용 컨테이너(헤더/버튼 제외) */}
                        <div ref={naturalTextRef} className="text-sm text-gray-700 whitespace-pre-wrap">
                            {naturalSummary}
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="text-xs text-yellow-800">
                            {quoteId ? (
                                <>현재 견적 ID: <span className="font-mono break-all">{quoteId}</span></>
                            ) : (
                                <>쿼리스트링 예: <code>?quoteId=00000000-0000-0000-0000-000000000000</code></>
                            )}
                        </div>
                        {quote && (
                            <div className="mt-2 text-xs text-gray-700 space-y-1">
                                <div>견적명: <span className="font-medium text-blue-600">{quote?.title}</span></div>
                                <div>상태: <span className="text-orange-600">{quote?.status}</span></div>
                            </div>
                        )}

                        <div className="mt-4 border-t pt-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">상세 서비스 정보</h5>
                            {loading ? (
                                <div className="text-xs text-gray-400">로딩 중...</div>
                            ) : (
                                <div className="space-y-3 text-sm text-gray-700">
                                    {/* 객실 */}
                                    {detailedServices.rooms && detailedServices.rooms.length > 0 && (
                                        <div>
                                            <h6 className="font-medium">🛏 객실</h6>
                                            <div className="space-y-2 mt-2">
                                                {detailedServices.rooms.map((r: any, i: number) => (
                                                    <div key={i} className="p-2 border rounded bg-white">
                                                        <div className="text-xs text-gray-600">기본 정보:</div>
                                                        <div className="text-sm font-medium">
                                                            {r.roomInfo?.room_code ? `객실 코드: ${r.roomInfo.room_code}` : ''} {r.item?.quantity ? `(수량: ${r.item.quantity})` : ''}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {(() => {
                                                                // DB에는 extra가 단일 컬럼(extra_count)로 저장됩니다.
                                                                const person = (r.roomInfo?.person_count ?? (r.roomInfo?.extra_count ?? 0)) || r.item?.quantity;
                                                                const extra = r.roomInfo?.extra_count ?? r.item?.extra_count;
                                                                const parts: string[] = [];
                                                                if (person !== undefined && person !== null) parts.push(`인원: ${person}`);
                                                                if (extra !== undefined && extra !== null && extra > 0) parts.push(`엑스트라: ${extra}`);
                                                                return parts.join(' / ');
                                                            })()}
                                                        </div>
                                                        {r.priceInfo && r.priceInfo.length > 0 && (
                                                            <div className="mt-2">
                                                                <div className="text-xs text-gray-600">가격 정보:</div>
                                                                {r.priceInfo.map((p: any, pi: number) => (
                                                                    <div key={pi} className="mt-1 p-2 bg-gray-50 rounded">
                                                                        <div className="text-sm">{p.schedule ? `일정: ${p.schedule}` : ''} {p.cruise ? ` / 크루즈: ${p.cruise}` : ''}</div>
                                                                        <div className="text-sm">{p.room_type ? `객실 타입: ${p.room_type}` : ''} {p.room_category ? ` / 카테고리: ${p.room_category}` : ''}</div>
                                                                        <div className="text-sm font-medium text-green-600">{p.price !== null && p.price !== undefined ? `기본 가격: ${p.price?.toLocaleString()}동` : ''} {p.base_price ? ` / 단가: ${p.base_price?.toLocaleString()}동` : ''}</div>
                                                                        <div className="text-sm text-blue-600 mt-1">총액: {r.calculated_total ? r.calculated_total?.toLocaleString() + '동' : (r.item?.total_price ? r.item.total_price?.toLocaleString() + '동' : (r.calculated_unit ? (Number(r.calculated_unit) * Number(r.calculated_count || r.item?.quantity || 1)).toLocaleString() + '동' : (r.item?.unit_price ? (r.item.unit_price * (r.item.quantity || 1)).toLocaleString() + '동' : '-')))}</div>
                                                                        {r.roomInfo?.sale && [3, 5, 8, 10].includes(Number(r.roomInfo.sale)) && (
                                                                            <div className="text-sm text-red-600 mt-1">
                                                                                {r.roomInfo.sale}% 할인 바우쳐 적용시 금액: {(() => {
                                                                                    const discountRate = 1 - (Number(r.roomInfo.sale) / 100);
                                                                                    const discounted = Math.round((r.calculated_total || r.item?.total_price || (Number(r.calculated_unit || 0) * Number(r.calculated_count || r.item?.quantity || 1))) * discountRate);
                                                                                    const man = Math.round((discounted / 10000));
                                                                                    return `${man.toLocaleString()}만동`;
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 차량 */}
                                    {detailedServices.cars && detailedServices.cars.length > 0 && (
                                        <div>
                                            <h6 className="font-medium">🚗 차량</h6>
                                            <div className="space-y-2 mt-2">
                                                {detailedServices.cars.map((c: any, i: number) => (
                                                    <div key={i} className="p-2 border rounded bg-white">
                                                        <div className="text-xs text-gray-600">기본 정보:</div>
                                                        <div className="text-sm font-medium">{c.carInfo?.car_code ? `차량 코드: ${c.carInfo.car_code}` : ''} {c.item?.quantity ? `(수량: ${c.item.quantity})` : ''}</div>
                                                        <div className="mt-2 text-xs text-gray-600">가격 정보:</div>
                                                        {c.priceInfo && c.priceInfo.length > 0 && c.priceInfo.map((p: any, pi: number) => (
                                                            <div key={pi} className="mt-1 p-2 bg-gray-50 rounded">
                                                                <div className="text-sm">{p.schedule ? `일정: ${p.schedule}` : ''} {p.cruise ? ` / 크루즈: ${p.cruise}` : ''}</div>
                                                                <div className="text-sm">{p.car_type ? `차량 타입: ${p.car_type}` : ''} {p.car_category ? ` / 카테고리: ${p.car_category}` : ''}</div>
                                                                <div className="text-sm font-medium text-green-600">{p.price !== null && p.price !== undefined ? `기본 가격: ${p.price?.toLocaleString()}동` : ''} {p.base_price ? ` / 단가: ${p.base_price?.toLocaleString()}동` : ''}</div>
                                                                <div className="text-sm text-blue-600 mt-1">총액: {c.item?.total_price ? c.item.total_price?.toLocaleString() + '동' : (c.item?.unit_price ? (c.item.unit_price * (c.item.quantity || 1)).toLocaleString() + '동' : '-')}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 공항 */}
                                    {detailedServices.airports && detailedServices.airports.length > 0 && (
                                        <div>
                                            <h6 className="font-medium">✈️ 공항 서비스</h6>
                                            <div className="space-y-2 mt-2">
                                                {detailedServices.airports.map((a: any, i: number) => (
                                                    <div key={i} className="p-2 border rounded bg-white">
                                                        <div className="text-xs text-gray-600">기본 정보:</div>
                                                        <div className="text-sm font-medium">{a.airportInfo?.airport_code ? `공항 코드: ${a.airportInfo.airport_code}` : ''} {a.item?.quantity ? `(승객수: ${a.item.quantity})` : ''}</div>
                                                        {a.priceInfo && a.priceInfo.length > 0 && (
                                                            <div className="mt-2">
                                                                <div className="text-xs text-gray-600">가격 정보:</div>
                                                                {a.priceInfo.map((p: any, pi: number) => (
                                                                    <div key={pi} className="mt-1 p-2 bg-gray-50 rounded">
                                                                        <div className="text-sm">{p.airport_category ? `카테고리: ${p.airport_category}` : ''} {p.airport_route ? ` / 경로: ${p.airport_route}` : ''}</div>
                                                                        <div className="text-sm">{p.airport_car_type ? `차량 타입: ${p.airport_car_type}` : ''}</div>
                                                                        <div className="text-sm font-medium text-green-600">{p.price !== null && p.price !== undefined ? `기본 가격: ${p.price?.toLocaleString()}동` : ''} {p.base_price ? ` / 단가: ${p.base_price?.toLocaleString()}동` : ''}</div>
                                                                        <div className="text-sm text-blue-600 mt-1">총액: {a.item?.total_price ? a.item.total_price?.toLocaleString() + '동' : (a.item?.unit_price ? (a.item.unit_price * (a.item.quantity || 1)).toLocaleString() + '동' : '-')}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 호텔 */}
                                    {detailedServices.hotels && detailedServices.hotels.length > 0 && (
                                        <div>
                                            <h6 className="font-medium">🏨 호텔</h6>
                                            <div className="space-y-2 mt-2">
                                                {detailedServices.hotels.map((h: any, i: number) => (
                                                    <div key={i} className="p-2 border rounded bg-white">
                                                        <div className="text-xs text-gray-600">기본 정보:</div>
                                                        <div className="text-sm font-medium">{h.hotelInfo?.hotel_code ? `호텔 코드: ${h.hotelInfo.hotel_code}` : ''}</div>
                                                        {h.priceInfo && h.priceInfo.length > 0 && h.priceInfo.map((p: any, pi: number) => (
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

                                    {/* 렌트카 */}
                                    {detailedServices.rentcars && detailedServices.rentcars.length > 0 && (
                                        <div>
                                            <h6 className="font-medium">🚙 렌트카</h6>
                                            <div className="space-y-2 mt-2">
                                                {detailedServices.rentcars.map((rc: any, i: number) => (
                                                    <div key={i} className="p-2 border rounded bg-white">
                                                        <div className="text-xs text-gray-600">기본 정보:</div>
                                                        <div className="text-sm font-medium">{rc.rentcarInfo?.rentcar_code ? `렌트카 코드: ${rc.rentcarInfo.rentcar_code}` : ''}</div>
                                                        {rc.priceInfo && rc.priceInfo.length > 0 && rc.priceInfo.map((p: any, pi: number) => (
                                                            <div key={pi} className="mt-1 p-2 bg-gray-50 rounded">
                                                                <div className="text-sm">{p.rent_type ? `렌트 타입: ${p.rent_type}` : ''} {p.rent_category ? ` / 카테고리: ${p.rent_category}` : ''}</div>
                                                                <div className="text-sm">{p.rent_route ? `경로: ${p.rent_route}` : ''}</div>
                                                                <div className="text-sm font-medium text-green-600">{p.price !== null && p.price !== undefined ? `기본 가격: ${p.price?.toLocaleString()}동` : ''} {p.base_price ? ` / 단가: ${p.base_price?.toLocaleString()}동` : ''}</div>
                                                                <div className="text-sm text-blue-600 mt-1">총액: {rc.item?.total_price ? rc.item.total_price?.toLocaleString() + '동' : (rc.item?.unit_price ? (rc.item.unit_price * (rc.item.quantity || 1)).toLocaleString() + '동' : '-')}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 투어 */}
                                    {detailedServices.tours && detailedServices.tours.length > 0 && (
                                        <div>
                                            <h6 className="font-medium">🎯 투어</h6>
                                            <div className="space-y-2 mt-2">
                                                {detailedServices.tours.map((t: any, i: number) => (
                                                    <div key={i} className="p-2 border rounded bg-white">
                                                        <div className="text-xs text-gray-600">기본 정보:</div>
                                                        <div className="text-sm font-medium">{t.tourInfo?.tour_code ? `투어 코드: ${t.tourInfo.tour_code}` : ''} {t.tourInfo?.tour_date ? ` / 날짜: ${t.tourInfo.tour_date}` : ''} {t.item?.quantity ? ` / 참가자수: ${t.item.quantity}` : ''}</div>
                                                        {t.priceInfo && t.priceInfo.length > 0 && t.priceInfo.map((p: any, pi: number) => (
                                                            <div key={pi} className="mt-1 p-2 bg-gray-50 rounded">
                                                                <div className="text-sm">{p.tour_name ? `투어명: ${p.tour_name}` : ''} {p.tour_capacity ? ` / 정원: ${p.tour_capacity}` : ''} {p.tour_vehicle ? ` / 차량: ${p.tour_vehicle}` : ''}</div>
                                                                <div className="text-sm font-medium text-green-600">{p.price !== null && p.price !== undefined ? `기본 가격: ${p.price?.toLocaleString()}동` : ''} {p.base_price ? ` / 단가: ${p.base_price?.toLocaleString()}동` : ''}</div>
                                                                <div className="text-sm text-blue-600 mt-1">총액: {t.item?.total_price ? t.item.total_price?.toLocaleString() + '동' : (t.item?.unit_price ? (t.item.unit_price * (t.item.quantity || 1)).toLocaleString() + '동' : '-')}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}

                                                {/* 합계 표시 */}
                                                {(() => {
                                                    const formatDong = (v: number | null | undefined) => {
                                                        if (v === null || v === undefined) return '-';
                                                        const man = Math.round((v / 10000));
                                                        return `${man.toLocaleString()}만동`;
                                                    };

                                                    return (
                                                        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                                                            <div className="text-sm text-gray-600">합계 (동화)</div>
                                                            <div className="text-lg font-bold text-red-600 mt-1">{formatDong(totalSummary.totalDong)}</div>
                                                            <div className="text-sm text-gray-600 mt-2">합계 (원화)</div>
                                                            <div className="text-lg font-bold text-blue-600 mt-1">{totalSummary.totalWon.toLocaleString()}원</div>
                                                            <div className="text-xs text-gray-500 mt-1">적용 환율: {exchangeRate ? formatExchangeRate(exchangeRate) : '—'}</div>
                                                            {rawExchangeRate !== null && (
                                                                <div className="text-xs text-gray-400 mt-1">(DB raw: {rawExchangeRate})</div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>


                    </div>
                </div>
            </div>
        </div>
    );
}

// TitleStarter는 탭 컨트롤로 대체됨

export default function ManagerCruiseQuoteNewPage() {
    const [pageRawRate, setPageRawRate] = useState<number | null>(null);
    useEffect(() => {
        let mounted = true;
        const fetchRate = async () => {
            try {
                const resp = await fetch('/api/exchange-rate?currency=VND');
                if (!resp.ok) return;
                const json = await resp.json();
                const raw = json?.data?.raw_rate_to_krw;
                if (mounted && raw !== undefined && raw !== null) setPageRawRate(Number(raw));
            } catch (e) { /* ignore */ }
        };

        // initial load
        fetchRate();

        // Listen for storage events so the exchange-rate admin page can signal an update
        const onStorage = (e: StorageEvent) => {
            if (!e.key) return;
            // admin page should set localStorage.setItem('exchange-rate:VND','updated') after successful update
            if (e.key === 'exchange-rate:VND' || e.key === 'exchange-rate:VND:updated' || e.key === 'exchange-rate:update') {
                fetchRate();
            }
        };
        window.addEventListener('storage', onStorage);

        // BroadcastChannel fallback for same-origin tabs
        let bc: BroadcastChannel | null = null;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                bc = new BroadcastChannel('exchange-rate');
                bc.addEventListener('message', (ev) => {
                    const data = ev.data;
                    if (data === 'updated' || data?.currency === 'VND') fetchRate();
                });
            }
        } catch { /* ignore */ }

        // Also refresh when user returns to the tab (visibilitychange)
        const onVisibility = () => {
            if (document.visibilityState === 'visible') fetchRate();
        };
        window.addEventListener('visibilitychange', onVisibility);

        return () => {
            mounted = false;
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('visibilitychange', onVisibility);
            try { if (bc) bc.close(); } catch { }
        };
    }, []);
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
                <div className="flex items-center justify-between w-full">
                    <ManagerServiceTabs active="cruise" />
                    {pageRawRate !== null && (
                        <div className="text-sm text-gray-500">환율(DB raw): {pageRawRate}</div>
                    )}
                </div>
                <ManagerCruiseQuoteForm />
            </ManagerLayout>
        </Suspense>
    );
}

