'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import {
    Save,
    ArrowLeft,
    Calendar,
    Hotel,
    MapPin,
    Users,
    User,
    Phone,
    Mail
} from 'lucide-react';

interface HotelReservation {
    reservation_id: string;
    hotel_price_code: string;
    checkin_date: string;
    nights: number;
    guest_count: number;
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
    hotel_price: {
        hotel_code: string;
        hotel_info: {
            name: string;
            location: string;
            description: string;
        } | null;
        price: number;
        conditions: string;
    } | null;
}

function HotelReservationEditContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const reservationId = searchParams.get('id');

    const [reservation, setReservation] = useState<HotelReservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        checkin_date: '',
        nights: 0,
        guest_count: 0,
        request_note: ''
    });

    useEffect(() => {
        if (reservationId) {
            loadReservation();
        } else {
            router.push('/manager/reservation-edit');
        }
    }, [reservationId]);

    const loadReservation = async () => {
        try {
            console.log('🔄 호텔 예약 데이터 로드 시작...', reservationId);
            setLoading(true);

            // 1) 서비스 상세
            const { data: hotelRow, error: hotelErr } = await supabase
                .from('reservation_hotel')
                .select('*')
                .eq('reservation_id', reservationId)
                .single();
            if (hotelErr || !hotelRow) throw hotelErr || new Error('예약 없음');

            // 2) 매니저 뷰 메타/고객
            const { data: mgrRow, error: mgrErr } = await supabase
                .from('manager_reservations')
                .select('re_id, re_status, re_created_at, re_quote_id, customer_name, customer_email, customer_phone')
                .eq('re_id', reservationId)
                .single();
            if (mgrErr || !mgrRow) throw mgrErr || new Error('매니저 뷰 접근 실패');

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

            // 4) 호텔 가격 정보
            let hotelPriceInfo = null as any;
            if (hotelRow.hotel_price_code) {
                const { data: hp, error: hpErr } = await supabase
                    .from('hotel_price')
                    .select(`
                        hotel_code,
                        price,
                        conditions,
                        hotel_info:hotel_code (
                            name,
                            location,
                            description
                        )
                    `)
                    .eq('hotel_code', hotelRow.hotel_price_code)
                    .single();
                if (!hpErr) hotelPriceInfo = hp;
            }

            const fullReservation: HotelReservation = {
                ...hotelRow,
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
                hotel_price: hotelPriceInfo,
            };

            setReservation(fullReservation);
            setFormData({
                checkin_date: hotelRow.checkin_date || '',
                nights: hotelRow.nights || 0,
                guest_count: hotelRow.guest_count || 0,
                request_note: hotelRow.request_note || ''
            });

        } catch (error) {
            console.error('❌ 호텔 예약 로드 실패:', error);
            alert('호텔 예약 정보를 불러오는데 실패했습니다.');
            router.push('/manager/reservation-edit');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!reservation) return;

        try {
            setSaving(true);
            console.log('💾 호텔 예약 수정 저장 시작...');

            const { error } = await supabase
                .from('reservation_hotel')
                .update({
                    checkin_date: formData.checkin_date,
                    nights: formData.nights,
                    guest_count: formData.guest_count,
                    request_note: formData.request_note,
                    updated_at: new Date().toISOString()
                })
                .eq('reservation_id', reservationId);

            if (error) {
                console.error('❌ 저장 실패:', error);
                throw error;
            }

            console.log('✅ 호텔 예약 수정 완료');
            alert('호텔 예약이 성공적으로 수정되었습니다.');

            // 데이터 다시 로드
            await loadReservation();

        } catch (error) {
            console.error('❌ 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const getCheckoutDate = () => {
        if (formData.checkin_date && formData.nights) {
            const checkin = new Date(formData.checkin_date);
            const checkout = new Date(checkin);
            checkout.setDate(checkout.getDate() + formData.nights);
            return checkout.toLocaleDateString('ko-KR');
        }
        return '';
    };

    if (loading) {
        return (
            <ManagerLayout title="🏨 호텔 예약 수정" activeTab="reservation-edit-hotel">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">호텔 예약 데이터를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        );
    }

    if (!reservation) {
        return (
            <ManagerLayout title="🏨 호텔 예약 수정" activeTab="reservation-edit-hotel">
                <div className="text-center py-12">
                    <Hotel className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">예약을 찾을 수 없습니다</h3>
                    <p className="text-gray-600 mb-4">요청하신 호텔 예약 정보를 찾을 수 없습니다.</p>
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
        <ManagerLayout title="🏨 호텔 예약 수정" activeTab="reservation-edit-hotel">
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
                        <h1 className="text-xl font-bold text-gray-900">호텔 예약 수정</h1>
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

                        {/* 호텔 정보 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <Hotel className="w-5 h-5" />
                                호텔 정보
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">호텔명</label>
                                    <div className="text-gray-900">
                                        {reservation.hotel_price?.hotel_info?.name || reservation.hotel_price_code}
                                    </div>
                                    {reservation.hotel_price?.hotel_info?.description && (
                                        <div className="text-sm text-gray-600 mt-1">
                                            {reservation.hotel_price.hotel_info.description}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
                                    <div className="text-gray-900 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        {reservation.hotel_price?.hotel_info?.location || '위치 정보 없음'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">1박 가격</label>
                                    <div className="text-gray-900">
                                        {reservation.hotel_price?.price?.toLocaleString()}동
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">조건</label>
                                    <div className="text-sm text-gray-600">
                                        {reservation.hotel_price?.conditions || '조건 없음'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 수정 가능한 필드들 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">예약 세부사항 수정</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Calendar className="inline w-4 h-4 mr-1" />
                                            체크인 날짜
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.checkin_date}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                checkin_date: e.target.value
                                            }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            숙박 일수
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={formData.nights}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                nights: parseInt(e.target.value) || 0
                                            }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {getCheckoutDate() && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            체크아웃 날짜 (자동 계산)
                                        </label>
                                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                                            {getCheckoutDate()}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Users className="inline w-4 h-4 mr-1" />
                                        투숙객 수
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={formData.guest_count}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            guest_count: parseInt(e.target.value) || 0
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        요청사항
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={formData.request_note}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            request_note: e.target.value
                                        }))}
                                        placeholder="룸 타입, 특별 요청사항, 추가 서비스 등을 입력하세요..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 우측: 예약 상태 및 저장 */}
                    <div className="space-y-6">
                        {/* 예약 상태 */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">예약 상태</h3>
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
                                {formData.nights > 0 && reservation.hotel_price?.price && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">예상 총 금액</label>
                                        <div className="text-lg font-bold text-green-600">
                                            {(formData.nights * reservation.hotel_price.price).toLocaleString()}동
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formData.nights}박 × {reservation.hotel_price.price.toLocaleString()}동
                                        </div>
                                    </div>
                                )}
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

export default function HotelReservationEditPage() {
    return (
        <Suspense fallback={
            <ManagerLayout title="🏨 호텔 예약 수정" activeTab="reservation-edit-hotel">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">페이지를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        }>
            <HotelReservationEditContent />
        </Suspense>
    );
}
