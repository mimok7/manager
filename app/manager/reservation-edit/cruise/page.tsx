'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import {
    Save,
    ArrowLeft,
    Calendar,
    Users,
    Ship,
    MapPin,
    Clock,
    User,
    Phone,
    Mail
} from 'lucide-react';

interface CruiseReservation {
    reservation_id: string;
    room_price_code: string;
    guest_count: number;
    checkin: string;
    room_total_price: number;
    request_note: string;
    // 추가 정보
    reservation: {
        re_id: string;
        re_status: string;
        re_created_at: string;
        users: {
            name: string;
            email: string;
            phone: string;
        };
        quote: {
            title: string;
        } | null;
    };
    room_price: {
        room_code: string;
        cruise?: string;
        room_type?: string;
        room_category?: string;
        schedule?: string;
        price: number;
        room_info?: {
            name: string;
            description: string;
            capacity: number;
        } | null;
    } | null;
}

function CruiseReservationEditContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const reservationId = searchParams.get('id');

    const [reservation, setReservation] = useState<CruiseReservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [carData, setCarData] = useState<any[]>([]);
    const [roomPriceDetail, setRoomPriceDetail] = useState<any>(null);
    const [roomPriceOptions, setRoomPriceOptions] = useState<any[]>([]);
    const [cruiseOptions, setCruiseOptions] = useState<string[]>([]);
    const [roomTypeOptions, setRoomTypeOptions] = useState<string[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    const [scheduleOptions, setScheduleOptions] = useState<string[]>([]);

    // 차량 가격 옵션
    const [carPriceOptions, setCarPriceOptions] = useState<any[]>([]);
    const [carCruiseOptions, setCarCruiseOptions] = useState<string[]>([]);
    const [carTypeOptions, setCarTypeOptions] = useState<string[]>([]);
    const [carCategoryOptions, setCarCategoryOptions] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        guest_count: 0,
        checkin: '',
        request_note: '',
        room_total_price: 0,
        room_price_code: ''
    });

    useEffect(() => {
        console.log('🔄 컴포넌트 상태 업데이트:', {
            reservation: reservation?.room_price,
            roomPriceDetail,
            room_price_code: reservation?.room_price_code
        });
    }, [reservation, roomPriceDetail]);

    useEffect(() => {
        if (reservationId) {
            loadReservation();
            loadRoomPriceOptions();
            loadCarPriceOptions();
        } else {
            router.push('/manager/reservation-edit');
        }
    }, [reservationId]);

    const loadRoomPriceOptions = async () => {
        try {
            // room_price 테이블에서 모든 옵션 가져오기 (날짜 정보 포함)
            const { data: allRoomPrices, error } = await supabase
                .from('room_price')
                .select('cruise, room_type, room_category, schedule, room_code, price, start_date, end_date')
                .order('cruise', { ascending: true });

            if (error) {
                console.error('❌ room_price 옵션 로드 실패:', error);
                return;
            }

            if (allRoomPrices && allRoomPrices.length > 0) {
                setRoomPriceOptions(allRoomPrices);

                // 고유한 옵션 추출
                const uniqueCruises = [...new Set(allRoomPrices.map(r => r.cruise).filter(Boolean))];
                const uniqueRoomTypes = [...new Set(allRoomPrices.map(r => r.room_type).filter(Boolean))];
                const uniqueCategories = [...new Set(allRoomPrices.map(r => r.room_category).filter(Boolean))];
                const uniqueSchedules = [...new Set(allRoomPrices.map(r => r.schedule).filter(Boolean))];

                setCruiseOptions(uniqueCruises as string[]);
                setRoomTypeOptions(uniqueRoomTypes as string[]);
                setCategoryOptions(uniqueCategories as string[]);
                setScheduleOptions(uniqueSchedules as string[]);

                console.log('✅ room_price 옵션 로드 완료:', {
                    총개수: allRoomPrices.length,
                    크루즈: uniqueCruises.length,
                    객실: uniqueRoomTypes.length,
                    카테고리: uniqueCategories.length,
                    일정: uniqueSchedules.length
                });
            }
        } catch (error) {
            console.error('❌ room_price 옵션 로드 오류:', error);
        }
    };

    const loadCarPriceOptions = async () => {
        try {
            // car_price 테이블에서 모든 옵션 가져오기
            const { data: allCarPrices, error } = await supabase
                .from('car_price')
                .select('cruise, car_type, car_category, car_code, price')
                .order('cruise', { ascending: true });

            if (error) {
                console.error('❌ car_price 옵션 로드 실패:', error);
                return;
            }

            if (allCarPrices && allCarPrices.length > 0) {
                setCarPriceOptions(allCarPrices);

                // 고유한 옵션 추출
                const uniqueCarCruises = [...new Set(allCarPrices.map(c => c.cruise).filter(Boolean))];
                const uniqueCarTypes = [...new Set(allCarPrices.map(c => c.car_type).filter(Boolean))];
                const uniqueCarCategories = [...new Set(allCarPrices.map(c => c.car_category).filter(Boolean))];

                setCarCruiseOptions(uniqueCarCruises as string[]);
                setCarTypeOptions(uniqueCarTypes as string[]);
                setCarCategoryOptions(uniqueCarCategories as string[]);

                console.log('✅ car_price 옵션 로드 완료:', {
                    총개수: allCarPrices.length,
                    크루즈: uniqueCarCruises.length,
                    차량: uniqueCarTypes.length,
                    카테고리: uniqueCarCategories.length
                });
            }
        } catch (error) {
            console.error('❌ car_price 옵션 로드 오류:', error);
        }
    };

    const loadReservation = async () => {
        try {
            console.log('🔄 크루즈 예약 데이터 로드 시작...', reservationId);
            setLoading(true);

            // 1) 서비스 상세 (단건)
            console.log('🔍 크루즈 예약 조회 시작, ID:', reservationId);
            const { data: cruiseRow, error: cruiseErr } = await supabase
                .from('reservation_cruise')
                .select('*')
                .eq('reservation_id', reservationId)
                .single();

            if (cruiseErr) {
                console.error('❌ reservation_cruise 조회 실패:', {
                    error: cruiseErr,
                    code: cruiseErr.code,
                    message: cruiseErr.message,
                    details: cruiseErr.details
                });

                if (cruiseErr.code === 'PGRST116') {
                    throw new Error(`예약 ID ${reservationId}에 해당하는 크루즈 예약을 찾을 수 없습니다.`);
                }
                throw new Error(`크루즈 예약 조회 실패: ${cruiseErr.message}`);
            }

            if (!cruiseRow) {
                throw new Error('크루즈 예약 데이터가 존재하지 않습니다.');
            }

            console.log('✅ 크루즈 예약 조회 성공:', {
                reservation_id: cruiseRow.reservation_id,
                room_price_code: cruiseRow.room_price_code,
                guest_count: cruiseRow.guest_count,
                checkin: cruiseRow.checkin,
                전체데이터: cruiseRow
            });

            // 2) 매니저 뷰에서 예약 메타/고객 정보
            console.log('🔍 매니저 예약 조회 시작');
            const { data: mgrRow, error: mgrErr } = await supabase
                .from('manager_reservations')
                .select('re_id, re_status, re_created_at, re_quote_id, customer_name, customer_email, customer_phone')
                .eq('re_id', reservationId)
                .single();

            if (mgrErr) {
                console.error('❌ manager_reservations 조회 실패:', {
                    error: mgrErr,
                    code: mgrErr.code,
                    message: mgrErr.message,
                    details: mgrErr.details
                });

                if (mgrErr.code === 'PGRST116') {
                    throw new Error(`예약 ID ${reservationId}에 해당하는 매니저 예약 정보를 찾을 수 없습니다.`);
                }
                throw new Error(`매니저 예약 조회 실패: ${mgrErr.message}`);
            }

            if (!mgrRow) {
                throw new Error('매니저 예약 데이터가 존재하지 않습니다.');
            }

            console.log('✅ 매니저 예약 조회 성공:', mgrRow.re_id);

            // 3) 견적 타이틀
            let quoteInfo = null as { title: string } | null;
            if (mgrRow.re_quote_id) {
                const { data: q, error: qErr } = await supabase
                    .from('quote')
                    .select('title')
                    .eq('id', mgrRow.re_quote_id)
                    .single();
                if (!qErr && q) quoteInfo = q;
            }

            // 4) 객실 가격 정보 (크루즈명, 객실명, 카테고리 포함)
            let roomPriceInfo = null as any;
            if (cruiseRow.room_price_code) {
                console.log('🔍 room_price 조회 시작, room_price_code:', cruiseRow.room_price_code);

                // 모달과 동일하게 조회 (conditions 제외)
                const { data: rpList, error: rpErr } = await supabase
                    .from('room_price')
                    .select('cruise, room_type, room_category, schedule, room_code, price')
                    .eq('room_code', cruiseRow.room_price_code);

                if (rpErr) {
                    console.error('❌ room_price 조회 실패:', {
                        error: rpErr,
                        message: rpErr.message,
                        code: rpErr.code,
                        details: rpErr.details,
                        hint: rpErr.hint
                    });
                } else {
                    console.log('✅ room_price 조회 결과:', {
                        count: rpList?.length || 0,
                        data: rpList
                    });

                    if (rpList && rpList.length > 0) {
                        roomPriceInfo = rpList[0];
                        setRoomPriceDetail(rpList[0]);
                        console.log('✅ room_price 데이터 설정 완료:', rpList[0]);
                    } else {
                        console.warn('⚠️ room_price 데이터 없음 - room_code로 일치하는 데이터가 없습니다');
                    }
                }
            } else {
                console.warn('⚠️ room_price_code가 없습니다 - cruiseRow:', cruiseRow);
            }            // 5) 차량 정보 조회
            console.log('🔍 차량 정보 조회 시작');
            const { data: cruiseCars } = await supabase
                .from('reservation_cruise_car')
                .select('*')
                .eq('reservation_id', reservationId);

            if (cruiseCars && cruiseCars.length > 0) {
                console.log('✅ 차량 데이터 조회 완료:', cruiseCars.length, '대');

                // 각 차량의 가격 정보 조회 (cruise, car_type, car_category, price 포함)
                const carsWithPrice = await Promise.all(
                    cruiseCars.map(async (car) => {
                        if (car.car_price_code) {
                            console.log('🔍 차량 가격 조회:', car.car_price_code);
                            const { data: carPrice } = await supabase
                                .from('car_price')
                                .select('cruise, car_type, car_category, car_code, price')
                                .eq('car_code', car.car_price_code)
                                .single();

                            if (carPrice) {
                                console.log('✅ 차량 가격 정보:', {
                                    car_code: carPrice.car_code,
                                    cruise: carPrice.cruise,
                                    car_type: carPrice.car_type,
                                    price: carPrice.price,
                                    car_count: car.car_count,
                                    passenger_count: car.passenger_count
                                });

                                // 차량 가격 자동 계산
                                const carCount = car.car_count || 0;
                                const passengerCount = car.passenger_count || 0;
                                const unitPrice = carPrice.price || 0;

                                const calculatedPrice = carCount > 0
                                    ? carCount * unitPrice
                                    : passengerCount * unitPrice;

                                console.log('💰 차량 가격 계산:', {
                                    차량수: carCount,
                                    승객수: passengerCount,
                                    단가: unitPrice,
                                    계산된가격: calculatedPrice,
                                    기존가격: car.car_total_price
                                });

                                return {
                                    ...car,
                                    priceInfo: carPrice,
                                    car_total_price: calculatedPrice // 계산된 가격으로 업데이트
                                };
                            } else {
                                console.warn('⚠️ 차량 가격 정보 없음:', car.car_price_code);
                            }

                            return { ...car, priceInfo: carPrice };
                        }
                        return { ...car, priceInfo: null };
                    })
                );
                setCarData(carsWithPrice);
                console.log('✅ 차량 데이터 설정 완료:', carsWithPrice);
            } else {
                console.log('ℹ️ 차량 정보 없음');
            }

            const fullReservation: CruiseReservation = {
                ...cruiseRow,
                reservation: {
                    re_id: mgrRow.re_id,
                    re_status: mgrRow.re_status,
                    re_created_at: mgrRow.re_created_at,
                    users: {
                        name: mgrRow.customer_name,
                        email: mgrRow.customer_email,
                        phone: mgrRow.customer_phone,
                    },
                    quote: quoteInfo,
                },
                room_price: roomPriceInfo,
            };

            console.log('📦 최종 예약 데이터:', {
                fullReservation,
                roomPriceInfo,
                roomPriceDetail: roomPriceInfo,
                cruiseRow_room_price_code: cruiseRow.room_price_code
            });

            setReservation(fullReservation);
            setFormData({
                guest_count: cruiseRow.guest_count || 0,
                checkin: cruiseRow.checkin || '',
                request_note: cruiseRow.request_note || '',
                room_total_price: cruiseRow.room_total_price || 0,
                room_price_code: cruiseRow.room_price_code || ''
            });

        } catch (error) {
            // 오류 객체를 더 자세히 로깅
            const errorDetails = {
                error: error,
                message: error instanceof Error ? error.message : '알 수 없는 오류',
                stack: error instanceof Error ? error.stack : undefined,
                type: typeof error,
                isNull: error === null,
                isUndefined: error === undefined
            };

            console.error('❌ 크루즈 예약 로드 실패:', errorDetails);

            // 사용자에게 표시할 메시지
            let userMessage = '크루즈 예약 정보를 불러오는데 실패했습니다.';
            if (error instanceof Error) {
                if (error.message.includes('찾을 수 없습니다')) {
                    userMessage = '해당 예약을 찾을 수 없습니다.';
                } else if (error.message.includes('권한')) {
                    userMessage = '이 예약을 조회할 권한이 없습니다.';
                } else {
                    userMessage = `오류: ${error.message}`;
                }
            }

            alert(userMessage);
            router.push('/manager/reservation-edit');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!reservation) return;

        try {
            setSaving(true);
            console.log('💾 크루즈 예약 수정 저장 시작...');
            console.log('📝 저장할 데이터:', {
                room_price_code: formData.room_price_code,
                guest_count: formData.guest_count,
                checkin: formData.checkin,
                request_note: formData.request_note,
                room_total_price: formData.room_total_price
            });

            // 1. 객실 정보 저장
            const updateData = {
                room_price_code: formData.room_price_code,
                guest_count: formData.guest_count,
                checkin: formData.checkin,
                request_note: formData.request_note,
                room_total_price: formData.room_total_price,
                updated_at: new Date().toISOString()
            };

            console.log('📤 업데이트 요청:', updateData);

            const { error } = await supabase
                .from('reservation_cruise')
                .update(updateData)
                .eq('reservation_id', reservationId);

            if (error) {
                console.error('❌ 객실 정보 저장 실패:', {
                    error,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });

                // updated_at 필드가 없는 경우 처리
                if (error.message?.includes('updated_at') || error.code === '42703') {
                    console.warn('⚠️ updated_at 컬럼이 없습니다. updated_at 없이 재시도합니다.');
                    delete updateData.updated_at;

                    const { error: retryError } = await supabase
                        .from('reservation_cruise')
                        .update(updateData)
                        .eq('reservation_id', reservationId);

                    if (retryError) {
                        console.error('❌ 재시도 실패:', retryError);
                        throw retryError;
                    }

                    console.log('✅ updated_at 없이 저장 완료 (데이터베이스에 updated_at 컬럼 추가 필요)');
                } else {
                    throw error;
                }
            } else {
                console.log('✅ 객실 정보 저장 완료');
            }

            // 2. 차량 정보 저장
            console.log('🚗 차량 정보 저장 시작:', carData.length, '대');
            for (const car of carData) {
                if (car.id) {
                    const { priceInfo, ...carUpdateData } = car;
                    console.log('📤 차량 업데이트:', { id: car.id, data: carUpdateData });

                    const { error: carError } = await supabase
                        .from('reservation_cruise_car')
                        .update(carUpdateData)
                        .eq('id', car.id);

                    if (carError) {
                        console.error('❌ 차량 정보 저장 실패:', carError);
                        throw carError;
                    }
                }
            }

            console.log('✅ 크루즈 예약 수정 완료');
            alert('크루즈 예약이 성공적으로 수정되었습니다.');

            // 데이터 다시 로드
            await loadReservation();

        } catch (error) {
            console.error('❌ 저장 오류:', error);
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`저장 중 오류가 발생했습니다: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ManagerLayout title="🚢 크루즈 예약 수정" activeTab="reservation-edit-cruise">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">크루즈 예약 데이터를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        );
    }

    if (!reservation) {
        return (
            <ManagerLayout title="🚢 크루즈 예약 수정" activeTab="reservation-edit-cruise">
                <div className="text-center py-12">
                    <Ship className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">예약을 찾을 수 없습니다</h3>
                    <p className="text-gray-600 mb-4">요청하신 크루즈 예약 정보를 찾을 수 없습니다.</p>
                    <button
                        onClick={() => router.push('/manager/reservation-edit')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        예약 목록으로 돌아가기
                    </button>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="🚢 크루즈 예약 수정" activeTab="reservation-edit-cruise">
            <div className="space-y-6">
                {/* 헤더 */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/manager/reservation-edit')}
                        className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        예약 목록으로
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">크루즈 예약 수정</h1>
                        <p className="text-sm text-gray-600">예약 ID: {reservation.reservation.re_id}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 좌측: 예약 정보 */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* 고객 정보 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <User className="w-5 h-5" />
                                고객 정보
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                    <div className="text-gray-900">{reservation.reservation.users.name}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                                    <div className="text-gray-900 flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        {reservation.reservation.users.email}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                                    <div className="text-gray-900 flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-gray-400" />
                                        {reservation.reservation.users.phone}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 객실 정보 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <Ship className="w-5 h-5" />
                                객실 정보 수정
                            </h3>
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 1. 체크인 날짜 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">체크인 날짜 *</label>
                                        <input
                                            type="date"
                                            value={formData.checkin}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                checkin: e.target.value
                                            }))}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>

                                    {/* 2. 일정 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">일정 *</label>
                                        <select
                                            value={(roomPriceDetail?.schedule || reservation.room_price?.schedule) || ''}
                                            onChange={(e) => {
                                                const selectedSchedule = e.target.value;
                                                // 선택된 일정에 맞는 첫 번째 객실 찾기
                                                const matchingRoom = roomPriceOptions.find(r => r.schedule === selectedSchedule);
                                                if (matchingRoom) {
                                                    setRoomPriceDetail(matchingRoom);
                                                    const totalPrice = formData.guest_count * (matchingRoom.price || 0);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        room_price_code: matchingRoom.room_code,
                                                        room_total_price: totalPrice
                                                    }));
                                                }
                                            }}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="">선택하세요</option>
                                            {scheduleOptions.map((schedule, idx) => (
                                                <option key={idx} value={schedule}>{schedule}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 3. 크루즈명 - 체크인 날짜와 일정에 따라 필터링 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">크루즈명 *</label>
                                        <select
                                            value={(roomPriceDetail?.cruise || reservation.room_price?.cruise) || ''}
                                            onChange={(e) => {
                                                const selectedCruise = e.target.value;
                                                const currentSchedule = roomPriceDetail?.schedule || reservation.room_price?.schedule;
                                                const currentCheckin = formData.checkin;
                                                // 선택된 일정과 크루즈에 맞는 객실 찾기
                                                const matchingRoom = roomPriceOptions.find(r =>
                                                    r.cruise === selectedCruise &&
                                                    r.schedule === currentSchedule &&
                                                    (!currentCheckin || !r.start_date || !r.end_date ||
                                                        (currentCheckin >= r.start_date && currentCheckin <= r.end_date))
                                                );
                                                if (matchingRoom) {
                                                    setRoomPriceDetail(matchingRoom);
                                                    const totalPrice = formData.guest_count * (matchingRoom.price || 0);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        room_price_code: matchingRoom.room_code,
                                                        room_total_price: totalPrice
                                                    }));
                                                }
                                            }}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="">선택하세요</option>
                                            {cruiseOptions
                                                .filter(cruise => {
                                                    const currentSchedule = roomPriceDetail?.schedule || reservation.room_price?.schedule;
                                                    const currentCheckin = formData.checkin;

                                                    if (!currentSchedule) return true;

                                                    return roomPriceOptions.some(r => {
                                                        const matchSchedule = r.cruise === cruise && r.schedule === currentSchedule;
                                                        if (!matchSchedule) return false;

                                                        // 체크인 날짜가 있으면 날짜 범위도 확인
                                                        if (currentCheckin && r.start_date && r.end_date) {
                                                            return currentCheckin >= r.start_date && currentCheckin <= r.end_date;
                                                        }
                                                        return true;
                                                    });
                                                })
                                                .map((cruise, idx) => (
                                                    <option key={idx} value={cruise}>{cruise}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    {/* 4. 객실명 - 일정과 크루즈에 따라 필터링 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">객실명 *</label>
                                        <select
                                            value={(roomPriceDetail?.room_type || reservation.room_price?.room_type) || ''}
                                            onChange={(e) => {
                                                const selectedRoomType = e.target.value;
                                                const currentSchedule = roomPriceDetail?.schedule || reservation.room_price?.schedule;
                                                const currentCruise = roomPriceDetail?.cruise || reservation.room_price?.cruise;
                                                const matchingRoom = roomPriceOptions.find(r =>
                                                    r.room_type === selectedRoomType &&
                                                    r.schedule === currentSchedule &&
                                                    r.cruise === currentCruise
                                                );
                                                if (matchingRoom) {
                                                    setRoomPriceDetail(matchingRoom);
                                                    const totalPrice = formData.guest_count * (matchingRoom.price || 0);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        room_price_code: matchingRoom.room_code,
                                                        room_total_price: totalPrice
                                                    }));
                                                }
                                            }}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="">선택하세요</option>
                                            {roomTypeOptions
                                                .filter(roomType => {
                                                    const currentSchedule = roomPriceDetail?.schedule || reservation.room_price?.schedule;
                                                    const currentCruise = roomPriceDetail?.cruise || reservation.room_price?.cruise;
                                                    if (!currentSchedule || !currentCruise) return true;
                                                    return roomPriceOptions.some(r =>
                                                        r.room_type === roomType &&
                                                        r.schedule === currentSchedule &&
                                                        r.cruise === currentCruise
                                                    );
                                                })
                                                .map((roomType, idx) => (
                                                    <option key={idx} value={roomType}>{roomType}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    {/* 5. 카테고리 - 일정, 크루즈, 객실명에 따라 필터링 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">카테고리 *</label>
                                        <select
                                            value={(roomPriceDetail?.room_category || reservation.room_price?.room_category) || ''}
                                            onChange={(e) => {
                                                const selectedCategory = e.target.value;
                                                const currentSchedule = roomPriceDetail?.schedule || reservation.room_price?.schedule;
                                                const currentCruise = roomPriceDetail?.cruise || reservation.room_price?.cruise;
                                                const currentRoomType = roomPriceDetail?.room_type || reservation.room_price?.room_type;
                                                const matchingRoom = roomPriceOptions.find(r =>
                                                    r.room_category === selectedCategory &&
                                                    r.schedule === currentSchedule &&
                                                    r.cruise === currentCruise &&
                                                    r.room_type === currentRoomType
                                                );
                                                if (matchingRoom) {
                                                    setRoomPriceDetail(matchingRoom);
                                                    const totalPrice = formData.guest_count * (matchingRoom.price || 0);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        room_price_code: matchingRoom.room_code,
                                                        room_total_price: totalPrice
                                                    }));
                                                }
                                            }}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="">선택하세요</option>
                                            {categoryOptions
                                                .filter(category => {
                                                    const currentSchedule = roomPriceDetail?.schedule || reservation.room_price?.schedule;
                                                    const currentCruise = roomPriceDetail?.cruise || reservation.room_price?.cruise;
                                                    const currentRoomType = roomPriceDetail?.room_type || reservation.room_price?.room_type;
                                                    if (!currentSchedule || !currentCruise || !currentRoomType) return true;
                                                    return roomPriceOptions.some(r =>
                                                        r.room_category === category &&
                                                        r.schedule === currentSchedule &&
                                                        r.cruise === currentCruise &&
                                                        r.room_type === currentRoomType
                                                    );
                                                })
                                                .map((category, idx) => (
                                                    <option key={idx} value={category}>{category}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    {/* 6. 게스트 수 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">게스트 수 *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={formData.guest_count}
                                            onChange={(e) => {
                                                const guestCount = parseInt(e.target.value) || 0;
                                                const unitPrice = roomPriceDetail?.price || reservation.room_price?.price || 0;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    guest_count: guestCount,
                                                    room_total_price: guestCount * unitPrice
                                                }));
                                            }}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>

                                    {/* 7. 객실 코드 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">객실 코드</label>
                                        <div className="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                            {formData.room_price_code || reservation.room_price_code || '자동 설정'}
                                        </div>
                                    </div>

                                    {/* 8. 객실 단가 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">객실 단가</label>
                                        <div className="text-sm text-gray-900 font-semibold bg-gray-100 px-2 py-1 rounded">
                                            {((roomPriceDetail?.price || reservation.room_price?.price) ?
                                                `${(roomPriceDetail?.price || reservation.room_price?.price).toLocaleString()}동` :
                                                '0동'
                                            )}
                                        </div>
                                    </div>

                                    {/* 9. 객실 총 금액 */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">객실 총 금액 (동) *</label>
                                        <div className="text-lg text-gray-900 font-bold bg-blue-50 px-3 py-2 rounded border-2 border-blue-200">
                                            {formData.room_total_price.toLocaleString()}동
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            💡 게스트 수 × 객실 단가 = {formData.guest_count} × {(roomPriceDetail?.price || reservation.room_price?.price || 0).toLocaleString()}동
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 차량 정보 */}
                        {carData.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                    <MapPin className="w-5 h-5" />
                                    차량 정보 수정 ({carData.length}대)
                                </h3>
                                <div className="space-y-4">
                                    {carData.map((car, idx) => (
                                        <div key={idx} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* 1. 크루즈명 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">크루즈명 *</label>
                                                    <select
                                                        value={car.priceInfo?.cruise || ''}
                                                        onChange={(e) => {
                                                            const selectedCruise = e.target.value;
                                                            const matchingCar = carPriceOptions.find(c => c.cruise === selectedCruise);
                                                            if (matchingCar) {
                                                                const carCount = car.car_count || 0;
                                                                const passengerCount = car.passenger_count || 0;
                                                                const unitPrice = matchingCar.price || 0;

                                                                // 차량 수가 있으면 차량 수 * 단가, 없으면 승객 수 * 단가
                                                                const totalPrice = carCount > 0
                                                                    ? carCount * unitPrice
                                                                    : passengerCount * unitPrice;

                                                                const newCarData = [...carData];
                                                                newCarData[idx] = {
                                                                    ...car,
                                                                    car_price_code: matchingCar.car_code,
                                                                    car_total_price: totalPrice,
                                                                    priceInfo: matchingCar
                                                                };
                                                                setCarData(newCarData);
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">선택하세요</option>
                                                        {carCruiseOptions.map((cruise, cidx) => (
                                                            <option key={cidx} value={cruise}>{cruise}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 2. 차량명 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">차량명 *</label>
                                                    <select
                                                        value={car.priceInfo?.car_type || ''}
                                                        onChange={(e) => {
                                                            const selectedCarType = e.target.value;
                                                            const matchingCar = carPriceOptions.find(c =>
                                                                c.car_type === selectedCarType &&
                                                                c.cruise === car.priceInfo?.cruise
                                                            );
                                                            if (matchingCar) {
                                                                const carCount = car.car_count || 0;
                                                                const passengerCount = car.passenger_count || 0;
                                                                const unitPrice = matchingCar.price || 0;

                                                                // 차량 수가 있으면 차량 수 * 단가, 없으면 승객 수 * 단가
                                                                const totalPrice = carCount > 0
                                                                    ? carCount * unitPrice
                                                                    : passengerCount * unitPrice;

                                                                const newCarData = [...carData];
                                                                newCarData[idx] = {
                                                                    ...car,
                                                                    car_price_code: matchingCar.car_code,
                                                                    car_total_price: totalPrice,
                                                                    priceInfo: matchingCar
                                                                };
                                                                setCarData(newCarData);
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">선택하세요</option>
                                                        {carTypeOptions.map((carType, cidx) => (
                                                            <option key={cidx} value={carType}>{carType}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 3. 카테고리 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">카테고리 *</label>
                                                    <select
                                                        value={car.priceInfo?.car_category || ''}
                                                        onChange={(e) => {
                                                            const selectedCategory = e.target.value;
                                                            const matchingCar = carPriceOptions.find(c =>
                                                                c.car_category === selectedCategory &&
                                                                c.cruise === car.priceInfo?.cruise &&
                                                                c.car_type === car.priceInfo?.car_type
                                                            );
                                                            if (matchingCar) {
                                                                const carCount = car.car_count || 0;
                                                                const passengerCount = car.passenger_count || 0;
                                                                const unitPrice = matchingCar.price || 0;

                                                                // 차량 수가 있으면 차량 수 * 단가, 없으면 승객 수 * 단가
                                                                const totalPrice = carCount > 0
                                                                    ? carCount * unitPrice
                                                                    : passengerCount * unitPrice;

                                                                const newCarData = [...carData];
                                                                newCarData[idx] = {
                                                                    ...car,
                                                                    car_price_code: matchingCar.car_code,
                                                                    car_total_price: totalPrice,
                                                                    priceInfo: matchingCar
                                                                };
                                                                setCarData(newCarData);
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">선택하세요</option>
                                                        {carCategoryOptions.map((category, cidx) => (
                                                            <option key={cidx} value={category}>{category}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 4. 차량 수 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">차량 수</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={car.car_count}
                                                        onChange={(e) => {
                                                            const carCount = parseInt(e.target.value) || 0;
                                                            const unitPrice = car.priceInfo?.price || 0;
                                                            const passengerCount = car.passenger_count || 0;

                                                            // 차량 수가 있으면 차량 수 * 단가, 없으면 승객 수 * 단가
                                                            const totalPrice = carCount > 0
                                                                ? carCount * unitPrice
                                                                : passengerCount * unitPrice;

                                                            const newCarData = [...carData];
                                                            newCarData[idx] = {
                                                                ...car,
                                                                car_count: carCount,
                                                                car_total_price: totalPrice
                                                            };
                                                            setCarData(newCarData);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>

                                                {/* 5. 승객 수 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">승객 수</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={car.passenger_count}
                                                        onChange={(e) => {
                                                            const passengerCount = parseInt(e.target.value) || 0;
                                                            const unitPrice = car.priceInfo?.price || 0;
                                                            const carCount = car.car_count || 0;

                                                            // 차량 수가 있으면 차량 수 * 단가, 없으면 승객 수 * 단가
                                                            const totalPrice = carCount > 0
                                                                ? carCount * unitPrice
                                                                : passengerCount * unitPrice;

                                                            const newCarData = [...carData];
                                                            newCarData[idx] = {
                                                                ...car,
                                                                passenger_count: passengerCount,
                                                                car_total_price: totalPrice
                                                            };
                                                            setCarData(newCarData);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>

                                                {/* 6. 픽업 장소 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">픽업 장소</label>
                                                    <input
                                                        type="text"
                                                        value={car.pickup_location || ''}
                                                        onChange={(e) => {
                                                            const newCarData = [...carData];
                                                            newCarData[idx].pickup_location = e.target.value;
                                                            setCarData(newCarData);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>

                                                {/* 7. 하차 장소 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">하차 장소</label>
                                                    <input
                                                        type="text"
                                                        value={car.dropoff_location || ''}
                                                        onChange={(e) => {
                                                            const newCarData = [...carData];
                                                            newCarData[idx].dropoff_location = e.target.value;
                                                            setCarData(newCarData);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>

                                                {/* 8. 픽업 시간 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">픽업 시간</label>
                                                    <input
                                                        type="date"
                                                        value={car.pickup_datetime || ''}
                                                        onChange={(e) => {
                                                            const newCarData = [...carData];
                                                            newCarData[idx].pickup_datetime = e.target.value;
                                                            setCarData(newCarData);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>

                                                {/* 9. 차량 코드 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">차량 코드</label>
                                                    <div className="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                                        {car.car_price_code || '자동 설정'}
                                                    </div>
                                                </div>

                                                {/* 10. 차량 단가 */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">차량 단가</label>
                                                    <div className="text-sm text-gray-900 font-semibold bg-gray-100 px-2 py-1 rounded">
                                                        {car.priceInfo?.price ? `${car.priceInfo.price.toLocaleString()}동` : '0동'}
                                                    </div>
                                                </div>

                                                {/* 11. 차량 가격 */}
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">차량 가격 (동) *</label>
                                                    <div className="text-lg text-gray-900 font-bold bg-green-50 px-3 py-2 rounded border-2 border-green-200">
                                                        {(() => {
                                                            const carCount = car.car_count || 0;
                                                            const passengerCount = car.passenger_count || 0;
                                                            const unitPrice = car.priceInfo?.price || 0;
                                                            const totalPrice = car.car_total_price || 0;

                                                            // 디버그 정보
                                                            console.log('🔍 차량 가격 표시:', {
                                                                idx,
                                                                carCount,
                                                                passengerCount,
                                                                unitPrice,
                                                                totalPrice,
                                                                car
                                                            });

                                                            return `${totalPrice.toLocaleString()}동`;
                                                        })()}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        💡 {car.car_count > 0
                                                            ? `차량 수 × 차량 단가 = ${car.car_count} × ${(car.priceInfo?.price || 0).toLocaleString()}동 = ${((car.car_count || 0) * (car.priceInfo?.price || 0)).toLocaleString()}동`
                                                            : `승객 수 × 차량 단가 = ${car.passenger_count || 0} × ${(car.priceInfo?.price || 0).toLocaleString()}동 = ${((car.passenger_count || 0) * (car.priceInfo?.price || 0)).toLocaleString()}동`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 요청사항 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">요청사항</h3>
                            <textarea
                                rows={6}
                                value={formData.request_note}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    request_note: e.target.value
                                }))}
                                placeholder="특별 요청사항이나 추가 서비스 정보를 입력하세요..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* 우측: 예약 상태 및 저장 */}
                    <div className="space-y-6">
                        {/* 예약 상태 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">예약 정보</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">상태</label>
                                    <div className="text-gray-900">{reservation.reservation.re_status}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">예약일</label>
                                    <div className="text-gray-900 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        {new Date(reservation.reservation.re_created_at).toLocaleDateString('ko-KR')}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">여행명</label>
                                    <div className="text-gray-900">
                                        {reservation.reservation.quote?.title || '제목 없음'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">게스트 수</label>
                                    <div className="text-gray-900 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-gray-400" />
                                        {formData.guest_count}명
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">체크인 날짜</label>
                                    <div className="text-gray-900 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        {formData.checkin ? new Date(formData.checkin).toLocaleDateString('ko-KR') : 'N/A'}
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-200 space-y-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">객실 금액</label>
                                        <div className="text-lg font-semibold text-gray-900">
                                            {formData.room_total_price.toLocaleString()}동
                                        </div>
                                    </div>
                                    {carData.length > 0 && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">차량 수</label>
                                                <div className="text-gray-900">
                                                    {carData.reduce((sum, car) => sum + (car.car_count || 0), 0)}대
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">차량 금액</label>
                                                <div className="text-lg font-semibold text-gray-900">
                                                    {carData.reduce((sum, car) => sum + (car.car_total_price || 0), 0).toLocaleString()}동
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <div className="pt-2 border-t border-gray-200">
                                        <label className="block text-sm font-medium text-gray-700">총 금액</label>
                                        <div className="text-xl font-bold text-green-600">
                                            {((formData.room_total_price || 0) + carData.reduce((sum, car) => sum + (car.car_total_price || 0), 0)).toLocaleString()}동
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 저장 버튼 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        저장 중...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        수정사항 저장
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ManagerLayout>
    );
}

export default function CruiseReservationEditPage() {
    return (
        <Suspense fallback={
            <ManagerLayout title="🚢 크루즈 예약 수정" activeTab="reservation-edit-cruise">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">페이지를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        }>
            <CruiseReservationEditContent />
        </Suspense>
    );
}
