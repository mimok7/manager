'use client';

import React, { useState, useEffect, useMemo } from 'react';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import { Search, Calendar, User, AlertCircle, CheckCircle, Ship } from 'lucide-react';

interface CruiseReservation {
    reservation_id: string;
    re_user_id: string;
    re_quote_id: string;
    re_status: string;
    re_created_at: string;
    boarding_code?: string;
    checkin?: string;
    room_price_code?: string;
    guest_count?: number;
    room_total_price?: number;
    request_note?: string;
    cruise_name?: string;
    users?: {
        name?: string;
        phone?: string;
        email?: string;
    };
    quote?: {
        title?: string;
        quote_id?: string;
    };
}

const BoardingCodePage = () => {
    const [reservations, setReservations] = useState<CruiseReservation[]>([]);
    const [filteredReservations, setFilteredReservations] = useState<CruiseReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 필터 상태
    const [statusFilter, setStatusFilter] = useState<'all' | 'has_code' | 'no_code'>('all');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [futureOnly, setFutureOnly] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');

    // 편집 상태
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingCode, setEditingCode] = useState<string>('');

    // 크루즈 예약 데이터 로드 (매니저 뷰 + 배치 조회)
    const loadCruiseReservations = async () => {
        try {
            setLoading(true);
            setError(null);

            // 1) 매니저 전용 뷰에서 크루즈 예약 기본 목록 조회
            const { data: baseRows, error: baseErr } = await supabase
                .from('manager_reservations')
                .select('re_id, re_user_id, re_quote_id, re_status, re_created_at, customer_name, customer_email, customer_phone')
                .eq('re_type', 'cruise')
                .order('re_created_at', { ascending: false });

            if (baseErr) {
                console.error('크루즈 예약 목록 조회 오류:', baseErr);
                setError('크루즈 예약 목록을 불러오지 못했습니다.');
                setReservations([]);
                return;
            }

            if (!baseRows || baseRows.length === 0) {
                setReservations([]);
                return;
            }

            const reIds = baseRows.map(r => r.re_id).filter(Boolean);
            const quoteIds = baseRows.map(r => r.re_quote_id).filter(Boolean);

            // 2) reservation_cruise 상세를 배치로 조회하여 맵으로 구성
            let cruiseMap: Record<string, any> = {};
            if (reIds.length > 0) {
                const { data: cruiseRows, error: cruiseErr } = await supabase
                    .from('reservation_cruise')
                    .select('reservation_id, boarding_code, checkin, room_price_code, guest_count, room_total_price, request_note')
                    .in('reservation_id', reIds);

                if (!cruiseErr && cruiseRows) {
                    cruiseMap = cruiseRows.reduce((acc: Record<string, any>, row: any) => {
                        acc[row.reservation_id] = row;
                        return acc;
                    }, {});
                } else if (cruiseErr) {
                    console.warn('크루즈 상세 배치 조회 오류:', cruiseErr);
                }
            }

            // 3) quote 타이틀을 배치로 조회하여 맵 구성
            let quoteMap: Record<string, any> = {};
            if (quoteIds.length > 0) {
                const { data: quotes, error: quoteErr } = await supabase
                    .from('quote')
                    .select('id, title')
                    .in('id', quoteIds);

                if (!quoteErr && quotes) {
                    quoteMap = quotes.reduce((acc: Record<string, any>, q: any) => {
                        acc[q.id] = q;
                        return acc;
                    }, {});
                } else if (quoteErr) {
                    console.warn('견적 타이틀 배치 조회 오류:', quoteErr);
                }
            }

            // 4) room_price를 배치로 조회해 크루즈명 맵 구성
            const roomPriceCodes = Object.values(cruiseMap)
                .map((c: any) => c?.room_price_code)
                .filter(Boolean);

            let roomPriceMap: Record<string, any> = {};
            if (roomPriceCodes.length > 0) {
                const { data: rpRows, error: rpErr } = await supabase
                    .from('room_price')
                    .select('room_code, cruise, room_category, room_type, schedule')
                    .in('room_code', roomPriceCodes);

                if (!rpErr && rpRows) {
                    roomPriceMap = rpRows.reduce((acc: Record<string, any>, row: any) => {
                        acc[row.room_code] = row;
                        return acc;
                    }, {});
                } else if (rpErr) {
                    console.warn('room_price 배치 조회 오류:', rpErr);
                }
            }

            // 5) 최종 머지
            const merged: CruiseReservation[] = baseRows.map((r: any) => {
                const c = cruiseMap[r.re_id] || {};
                const q = r.re_quote_id ? quoteMap[r.re_quote_id] : undefined;
                const rp = c.room_price_code ? roomPriceMap[c.room_price_code] : undefined;
                return {
                    reservation_id: r.re_id,
                    re_user_id: r.re_user_id,
                    re_quote_id: r.re_quote_id,
                    re_status: r.re_status,
                    re_created_at: r.re_created_at,
                    boarding_code: c.boarding_code,
                    checkin: c.checkin,
                    room_price_code: c.room_price_code,
                    guest_count: c.guest_count,
                    room_total_price: c.room_total_price,
                    request_note: c.request_note,
                    cruise_name: rp?.cruise,
                    users: {
                        name: r.customer_name,
                        email: r.customer_email,
                        phone: r.customer_phone
                    },
                    quote: q ? { title: q.title, quote_id: r.re_quote_id } : undefined
                };
            });

            setReservations(merged);
            console.log('크루즈 예약 데이터 로드 완료:', merged.length, '건');
        } catch (err) {
            console.error('예상치 못한 오류:', err);
            setError('데이터 로드 중 예상치 못한 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 필터링 로직
    useEffect(() => {
        let filtered = [...reservations];

        // 승선 코드 상태 필터
        if (statusFilter === 'has_code') {
            filtered = filtered.filter(r => r.boarding_code && r.boarding_code.trim() !== '');
        } else if (statusFilter === 'no_code') {
            filtered = filtered.filter(r => !r.boarding_code || r.boarding_code.trim() === '');
        }

        // 날짜 필터 (체크인 날짜 기준)
        if (dateFilter) {
            filtered = filtered.filter(r => {
                if (!r.checkin) return false;
                const checkinDate = new Date(r.checkin).toISOString().split('T')[0];
                return checkinDate === dateFilter;
            });
        }

        // 오늘 이후만 보기
        if (futureOnly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            filtered = filtered.filter(r => {
                if (!r.checkin) return false;
                const d = new Date(r.checkin);
                d.setHours(0, 0, 0, 0);
                return d >= today;
            });
        }

        // 검색 필터
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                r.users?.name?.toLowerCase().includes(q) ||
                r.quote?.title?.toLowerCase().includes(q) ||
                r.cruise_name?.toLowerCase().includes(q) ||
                r.boarding_code?.toLowerCase().includes(q) ||
                r.re_quote_id?.toLowerCase().includes(q)
            );
        }

        // 체크인 기준 정렬
        filtered.sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));

        setFilteredReservations(filtered);
    }, [reservations, statusFilter, dateFilter, searchTerm, futureOnly]);

    // 승선 코드 업데이트
    const updateBoardingCode = async (reservationId: string, newCode: string) => {
        try {
            const { error: updateError } = await supabase
                .from('reservation_cruise')
                .update({ boarding_code: newCode.trim() || null })
                .eq('reservation_id', reservationId);

            if (updateError) {
                console.error('승선 코드 업데이트 오류:', updateError);
                alert('승선 코드 업데이트에 실패했습니다.');
                return;
            }

            // 로컬 상태 업데이트
            setReservations(prev =>
                prev.map(r =>
                    r.reservation_id === reservationId
                        ? { ...r, boarding_code: newCode.trim() || undefined }
                        : r
                )
            );

            setEditingId(null);
            setEditingCode('');
            console.log('승선 코드 업데이트 완료:', reservationId, '→', newCode);
        } catch (err) {
            console.error('승선 코드 업데이트 예외:', err);
            alert('승선 코드 업데이트 중 오류가 발생했습니다.');
        }
    };

    // 편집 시작
    const startEditing = (reservationId: string, currentCode: string = '') => {
        setEditingId(reservationId);
        setEditingCode(currentCode);
    };

    // 편집 취소
    const cancelEditing = () => {
        setEditingId(null);
        setEditingCode('');
    };

    // 컴포넌트 마운트시 데이터 로드
    useEffect(() => {
        loadCruiseReservations();
    }, []);

    // 체크인 기준 그룹화 메모
    const groupedByCheckin = useMemo(() => {
        const map: Record<string, CruiseReservation[]> = {};
        for (const r of filteredReservations) {
            const key = r.checkin ? r.checkin.slice(0, 10) : '미정';
            (map[key] ||= []).push(r);
        }
        return Object.entries(map)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, items]) => ({ date, items }));
    }, [filteredReservations]);

    if (loading) {
        return (
            <ManagerLayout title="승선 코드 관리" activeTab="boarding-code">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="ml-4 text-gray-600">크루즈 예약 데이터를 불러오는 중...</p>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="승선 코드 관리" activeTab="boarding-code">
            <div className="space-y-6">
                {/* 헤더 및 통계 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Ship className="w-6 h-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-800">크루즈 승선 코드 관리</h1>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <Ship className="w-5 h-5 text-blue-600" />
                                <span className="text-sm text-blue-600">전체 크루즈 예약</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-700 mt-1">
                                {reservations.length}건
                            </div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm text-green-600">승선 코드 발급완료</span>
                            </div>
                            <div className="text-2xl font-bold text-green-700 mt-1">
                                {reservations.filter(r => r.boarding_code && r.boarding_code.trim() !== '').length}건
                            </div>
                        </div>

                        <div className="bg-orange-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                <span className="text-sm text-orange-600">승선 코드 미발급</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-700 mt-1">
                                {reservations.filter(r => !r.boarding_code || r.boarding_code.trim() === '').length}건
                            </div>
                        </div>
                    </div>
                </div>

                {/* 필터 섹션 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 승선 코드 상태 필터 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">승선 코드 상태</label>
                            <div className="flex gap-2">
                                {[
                                    { key: 'all', label: '전체', color: 'bg-gray-100 text-gray-700' },
                                    { key: 'has_code', label: '발급완료', color: 'bg-green-100 text-green-700' },
                                    { key: 'no_code', label: '미발급', color: 'bg-orange-100 text-orange-700' }
                                ].map(status => (
                                    <button
                                        key={status.key}
                                        onClick={() => setStatusFilter(status.key as any)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === status.key
                                            ? status.color.replace('100', '200').replace('700', '800')
                                            : status.color
                                            }`}
                                    >
                                        {status.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 날짜 필터 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">체크인 날짜</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={futureOnly}
                                    onChange={(e) => setFutureOnly(e.target.checked)}
                                />
                                오늘 이후만 보기
                            </label>
                        </div>

                        {/* 검색 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="이름, 여행명, 승선코드, 견적ID 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 필터 초기화 */}
                    {(statusFilter !== 'all' || dateFilter || searchTerm || futureOnly) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setStatusFilter('all');
                                    setDateFilter('');
                                    setFutureOnly(true);
                                    setSearchTerm('');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                모든 필터 초기화
                            </button>
                        </div>
                    )}
                </div>

                {/* 예약 목록 */}
                <div className="bg-white rounded-lg shadow-sm">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800">
                            크루즈 예약 목록 ({filteredReservations.length}건)
                        </h2>
                    </div>

                    {error && (
                        <div className="p-6 bg-red-50 border-l-4 border-red-400">
                            <div className="flex items-center">
                                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                                <p className="text-red-700">{error}</p>
                            </div>
                            <button
                                onClick={loadCruiseReservations}
                                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                            >
                                다시 시도
                            </button>
                        </div>
                    )}

                    {filteredReservations.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Ship className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p>조건에 맞는 크루즈 예약이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                {groupedByCheckin.map(group => (
                                    <React.Fragment key={`group-${group.date}`}>
                                        {/* 그룹 헤더 */}
                                        <div className="col-span-full">
                                            <div className="bg-gray-100 rounded-lg px-4 py-2 mb-4">
                                                <h3 className="text-sm font-semibold text-gray-700">
                                                    체크인 {group.date} · {group.items.length}건
                                                </h3>
                                            </div>
                                        </div>

                                        {/* 그룹 내 카드들 */}
                                        {group.items.map((reservation) => (
                                            <div key={reservation.reservation_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                {/* 예약 정보 섹션 */}
                                                <div className="mb-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {reservation.users?.name || '이름 없음'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mb-1">
                                                        {reservation.quote?.title || '제목 없음'}
                                                    </div>
                                                    {/* 견적ID는 사용자 카드에서 제거됨 */}
                                                </div>

                                                {/* 크루즈 일정 섹션 */}
                                                <div className="mb-3">
                                                    <div className="text-xs text-gray-600 mb-1">
                                                        {reservation.checkin ? (
                                                            <>
                                                                <div className="font-medium">
                                                                    체크인: {new Date(reservation.checkin).toLocaleDateString('ko-KR')}
                                                                </div>
                                                                <div className="text-gray-500">
                                                                    {reservation.cruise_name || '크루즈명 미정'}
                                                                </div>
                                                                <div className="text-gray-500">
                                                                    {reservation.guest_count ? `${reservation.guest_count}명` : '인원 미정'}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400">일정 미정</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 승선 코드 섹션 */}
                                                <div className="mb-3">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        승선 코드
                                                    </label>
                                                    {editingId === reservation.reservation_id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingCode}
                                                                onChange={(e) => setEditingCode(e.target.value)}
                                                                placeholder="승선 코드 입력"
                                                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => updateBoardingCode(reservation.reservation_id, editingCode)}
                                                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                                            >
                                                                저장
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                                                            >
                                                                취소
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                {reservation.boarding_code ? (
                                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                                        {reservation.boarding_code}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                                        미발급
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => startEditing(reservation.reservation_id, reservation.boarding_code || '')}
                                                                disabled={editingId !== null}
                                                                className="text-xs text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                                                            >
                                                                {reservation.boarding_code ? '수정' : '발급'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 예약 상태 섹션 */}
                                                <div className="flex items-center justify-between">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${reservation.re_status === 'confirmed'
                                                        ? 'bg-green-100 text-green-800'
                                                        : reservation.re_status === 'pending'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {reservation.re_status}
                                                    </span>
                                                    <div className="text-xs text-gray-400">
                                                        {new Date(reservation.re_created_at).toLocaleDateString('ko-KR')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ManagerLayout>
    );
};

export default BoardingCodePage;
