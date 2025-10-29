"use client";

import React, { useEffect, useState } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import { User, Mail, ChevronRight, CheckCircle, XCircle, Clock, Ship, Plane, Building, MapPin, Car, Plus, Calendar, Edit } from 'lucide-react';

interface ReservationData {
  re_id: string;
  re_type: string;
  re_status: string;
  re_created_at: string;
  re_user_id: string;
  users: {
    id: string;
    name: string;
    email: string;
  };
  quote: {
    title: string;
    status: string;
  };
  serviceDetails?: any;
  serviceDetailsExtra?: any;
}

interface GroupedReservations {
  [userId: string]: {
    userInfo: {
      id: string;
      name: string;
      email: string;
    };
    reservations: ReservationData[];
    totalCount: number;
    statusCounts: {
      pending: number;
      confirmed: number;
      cancelled: number;
    };
  };
}

export default function ManagerReservationsPage() {
  // 예약 통계 상태 추가
  const [stats, setStats] = useState<{ total: number; pending: number; confirmed: number; cancelled: number }>({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  // 기존 사용자 데이터 조회 유지
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 올드 양식의 상태/필터/모달 등 추가
  const [groupedReservations, setGroupedReservations] = useState<GroupedReservations>({});
  const [filter, setFilter] = useState('all');
  const [searchName, setSearchName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalView, setModalView] = useState<'user' | 'reservation'>('user');

  // 사용자/견적/서비스/예약 집계 함수
  const fetchUsersWithQuoteServiceReservation = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 데이터 조회 시작...');

      // 1. 모든 사용자 조회
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, english_name, email')
        .order('name', { ascending: true });

      if (usersError) {
        console.error('❌ 사용자 조회 오류:', usersError);
        setError(usersError.message);
        setUsers([]);
        setLoading(false);
        return;
      }

      console.log('👥 조회된 사용자 수:', usersData?.length || 0);

      // 2. 사용자별 견적 집계
      const { data: quotesData, error: quotesError } = await supabase
        .from('quote')
        .select('id, user_id, title, status');

      if (quotesError) {
        console.error('❌ 견적 조회 오류:', quotesError);
      }

      console.log('📋 조회된 견적 수:', quotesData?.length || 0);

      // 3. quote별 quote_item 집계
      const quoteIds = quotesData ? quotesData.map(q => q.id) : [];
      let quoteItemData: any[] = [];
      if (quoteIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('quote_item')
          .select('quote_id, service_type')
          .in('quote_id', quoteIds);

        if (itemsError) {
          console.error('❌ 견적 아이템 조회 오류:', itemsError);
        } else {
          quoteItemData = itemsData || [];
          console.log('🛠️ 조회된 견적 아이템 수:', quoteItemData.length);
        }
      }

      // 4. 사용자별 예약 집계
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservation')
        .select('re_user_id, re_type, re_status, re_quote_id');

      if (reservationsError) {
        console.error('❌ 예약 조회 오류:', reservationsError);
      }

      console.log('📅 조회된 예약 수:', reservationsData?.length || 0);

      // 예약 타입 표준화 헬퍼
      const normalizeType = (t?: string) => {
        const type = (t || '').toLowerCase();
        if (!type) return undefined;
        if (type === 'room' || type === 'cruise') return 'cruise';
        if (type === 'airport' || type === 'air' || type === 'pickup' || type === 'sending') return 'airport';
        if (type === 'hotel') return 'hotel';
        if (type === 'rentcar' || type === 'rent_car' || type === 'rentalcar') return 'rentcar';
        if (type === 'tour') return 'tour';
        if (type === 'car' || type === 'vehicle' || type === 'car_sht' || type === 'sht' || type === 'reservation_car_sht') return 'car';
        return type;
      };

      // 사용자별 예약 개수 및 타입별 집계
      const reservationCountMap: Record<string, number> = {};
      const reservationTypeCountByUser: Record<string, Record<string, number>> = {};
      const reservationServiceMap: Record<string, Set<string>> = {};

      if (reservationsData) {
        reservationsData.forEach(r => {
          const uid = r.re_user_id;
          if (!uid) return;
          reservationCountMap[uid] = (reservationCountMap[uid] || 0) + 1;

          const norm = normalizeType(r.re_type);
          if (!norm) return;

          if (!reservationTypeCountByUser[uid]) reservationTypeCountByUser[uid] = {};
          reservationTypeCountByUser[uid][norm] = (reservationTypeCountByUser[uid][norm] || 0) + 1;

          if (!reservationServiceMap[uid]) reservationServiceMap[uid] = new Set();
          reservationServiceMap[uid].add(norm);
        });
      }

      // userId별 견적 개수 및 서비스명 집계
      const quoteCountMap: Record<string, number> = {};
      const serviceMap: Record<string, Set<string>> = {};

      if (quotesData) {
        quotesData.forEach(q => {
          if (q.user_id) {
            quoteCountMap[q.user_id] = (quoteCountMap[q.user_id] || 0) + 1;
            // 해당 견적의 서비스명 집계
            const items = quoteItemData.filter(item => item.quote_id === q.id);
            if (!serviceMap[q.user_id]) {
              serviceMap[q.user_id] = new Set();
            }
            items.forEach(item => {
              if (item.service_type) {
                serviceMap[q.user_id].add(item.service_type);
              }
            });
          }
        });
      }

      // users에 추가 정보 병합
      const usersWithQuoteInfo = usersData.map(u => {
        const quoteCount = quoteCountMap[u.id] || 0;
        const serviceNames = serviceMap[u.id] ? Array.from(serviceMap[u.id]) : [];
        const reservationCount = reservationCountMap[u.id] || 0;
        const reservationServiceNames = reservationServiceMap[u.id] ? Array.from(reservationServiceMap[u.id]) : [];
        const typeCountObj = reservationTypeCountByUser[u.id] || {};
        const reservationTypeCounts = Object.keys(typeCountObj)
          .sort()
          .map((k) => ({ type: k, count: typeCountObj[k] }));

        return {
          ...u,
          quoteCount,
          serviceNames,
          reservationCount,
          reservationServiceNames,
          reservationTypeCounts,
        };
      });

      console.log('✅ 최종 사용자 데이터 처리 완료');
      console.log('📊 사용자별 통계 샘플:', usersWithQuoteInfo.slice(0, 3));

      setUsers(usersWithQuoteInfo);
      setLoading(false);

    } catch (error) {
      console.error('💥 전체 데이터 조회 실패:', error);
      setError(error instanceof Error ? error.message : '데이터 조회 중 오류가 발생했습니다.');
      setUsers([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersWithQuoteServiceReservation();

    // 디버깅을 위해 5초 후에 현재 상태 출력
    setTimeout(() => {
      console.log('🎯 현재 상태 확인:');
      console.log('👥 Users 상태:', users);
      console.log('📊 Stats 상태:', stats);
      console.log('🗂️ GroupedReservations 상태:', groupedReservations);
    }, 5000);
  }, []);

  // 예약 통계 계산 (users가 변경될 때마다)
  useEffect(() => {
    // users 배열을 GroupedReservations 구조로 변환
    const grouped: GroupedReservations = {};
    users.forEach(user => {
      grouped[user.id] = {
        userInfo: {
          id: user.id,
          name: user.name || '-',
          email: user.email || '-',
        },
        reservations: [], // 실제 예약 데이터가 없으므로 빈 배열
        totalCount: 0,
        statusCounts: {
          pending: 0,
          confirmed: 0,
          cancelled: 0,
        },
      };
    });
    setGroupedReservations(grouped);
    // 예약 통계 계산 (실제 예약 데이터가 없으므로 모두 0, 전체 사용자 수만 표시)
    setStats({
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
    });
  }, [users]);

  // 실제 예약 통계 집계 (reservation 테이블 기반)
  useEffect(() => {
    const fetchReservationStats = async () => {
      setStatsLoading(true);

      try {
        console.log('📊 예약 통계 조회 시작...');

        const { data, error } = await supabase
          .from('reservation')
          .select('re_status');

        if (error) {
          console.error('❌ 예약 통계 조회 오류:', error);
          setStats({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
          setStatsLoading(false);
          return;
        }

        if (!data) {
          console.log('⚠️ 예약 데이터가 없습니다.');
          setStats({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
          setStatsLoading(false);
          return;
        }

        const total = data.length;
        const pending = data.filter(r => r.re_status === 'pending').length;
        const confirmed = data.filter(r => r.re_status === 'confirmed').length;
        const cancelled = data.filter(r => r.re_status === 'cancelled').length;

        console.log('📈 예약 통계:', { total, pending, confirmed, cancelled });

        setStats({ total, pending, confirmed, cancelled });
        setStatsLoading(false);

      } catch (error) {
        console.error('💥 예약 통계 조회 실패:', error);
        setStats({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
        setStatsLoading(false);
      }
    };

    fetchReservationStats();
  }, []);
  // 올드 양식의 UI/필터/검색/모달 적용
  const getFilteredUsers = () => {
    return Object.keys(groupedReservations)
      .filter(userId => {
        const userGroup = groupedReservations[userId];
        // 이름/이메일 검색
        const nameMatch = !searchName ||
          userGroup.userInfo.name.toLowerCase().includes(searchName.toLowerCase()) ||
          userGroup.userInfo.email.toLowerCase().includes(searchName.toLowerCase());
        return nameMatch;
      })
      .sort((userIdA, userIdB) => {
        const userA = groupedReservations[userIdA].userInfo.name;
        const userB = groupedReservations[userIdB].userInfo.name;
        return userA.localeCompare(userB, 'ko-KR');
      });
  };
  const filteredUsers = getFilteredUsers();

  const clearSearch = () => setSearchName('');
  const openUserModal = (userGroup: any) => {
    setSelectedUser(userGroup);
    setModalView('user');
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setModalView('user');
  };

  return (
    <ManagerLayout title="예약 관리" activeTab="reservations">
      <div className="space-y-6">
        {/* 로딩 상태 */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">데이터를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">⚠️ 데이터 로드 오류</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={fetchUsersWithQuoteServiceReservation}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 예약 통계 카드 - 상단에 크게 표시 */}
        <div className="flex gap-4 mb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-3 flex items-center gap-3 text-base">
            <User className="w-6 h-6 text-blue-500" />
            <span className="font-semibold">전체 사용자</span>
            <span className="font-extrabold text-blue-600 text-xl">{Object.keys(groupedReservations).length.toLocaleString()}명</span>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-6 py-3 flex items-center gap-3 text-base">
            <User className="w-6 h-6 text-gray-400" />
            <span className="font-semibold">전체 예약</span>
            <span className="font-extrabold text-gray-700 text-xl">{stats ? stats.total : 0}건</span>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-6 py-3 flex items-center gap-3 text-base">
            <Clock className="w-6 h-6 text-yellow-500" />
            <span className="font-semibold">대기중</span>
            <span className="font-extrabold text-yellow-700 text-xl">{stats ? stats.pending : 0}건</span>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl px-6 py-3 flex items-center gap-3 text-base">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <span className="font-semibold">확정</span>
            <span className="font-extrabold text-green-700 text-xl">{stats ? stats.confirmed : 0}건</span>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl px-6 py-3 flex items-center gap-3 text-base">
            <XCircle className="w-6 h-6 text-red-500" />
            <span className="font-semibold">취소</span>
            <span className="font-extrabold text-red-700 text-xl">{stats ? stats.cancelled : 0}건</span>
          </div>
        </div>
        {/* 헤더 및 검색 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-6 h-6 text-blue-600" />
                고객별 예약 관리
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                총 {Object.keys(groupedReservations).length}명의 고객
                {searchName && ` (검색: ${filteredUsers.length}명)`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLoading(true)}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
              >
                {loading ? '새로고침 중...' : '🔄 새로고침'}
              </button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
            <div className="flex-1 md:max-w-xs">
              <h4 className="text-md font-semibold mb-3">고객 검색</h4>
              <div className="relative">
                <input
                  type="text"
                  placeholder="고객 이름 또는 이메일로 검색..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                {searchName && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              {searchName && (
                <p className="text-sm text-gray-500 mt-1">
                  "{searchName}" 검색 결과: {filteredUsers.length}명
                </p>
              )}
            </div>
          </div>
        </div>
        {/* 고객별 목록 */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">고객별 예약 목록</h3>
            <p className="text-sm text-gray-600 mt-1">
              고객 정보를 클릭하면 해당 고객의 상세 정보를 확인할 수 있습니다.
              {searchName && ` (이름순 정렬, "${searchName}" 검색 중)`}
            </p>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                {searchName
                  ? `"${searchName}"로 검색된 고객이 없습니다`
                  : '예약 고객이 없습니다'}
              </h3>
              {searchName && (
                <button
                  onClick={fetchUsersWithQuoteServiceReservation}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                >
                  검색 초기화
                </button>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {filteredUsers.map((userId) => {
                  const userGroup = groupedReservations[userId];
                  // users 배열에서 quoteCount, serviceNames, reservationServiceNames 가져오기
                  const userObj = users.find(u => u.id === userId);
                  return (
                    <div
                      key={userId}
                      className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openUserModal(userGroup)}
                    >
                      <div className="p-4 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <User className="w-8 h-8 p-1.5 bg-blue-100 text-blue-600 rounded-full flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-sm text-gray-800 truncate">
                              {userGroup.userInfo.name}
                            </h4>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        </div>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{userGroup.userInfo.email}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="truncate">견적: {userObj?.quoteCount ?? 0}건</span>
                          </div>
                          {userObj?.serviceNames?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {userObj.serviceNames.map((s: string, idx: number) => {
                                let color = 'bg-gray-100 text-gray-700 border-gray-200';
                                if (s === 'room') color = 'bg-blue-50 text-blue-600 border-blue-200';
                                else if (s === 'car') color = 'bg-green-50 text-green-600 border-green-200';
                                else if (s === 'airport') color = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                                else if (s === 'hotel') color = 'bg-purple-50 text-purple-600 border-purple-200';
                                else if (s === 'tour') color = 'bg-orange-50 text-orange-600 border-orange-200';
                                else if (s === 'rentcar') color = 'bg-gray-200 text-gray-700 border-gray-300';
                                return (
                                  <span key={idx} className={`px-2 py-0.5 rounded text-[11px] border font-semibold ${color}`}>{s}</span>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                            <span className="truncate">예약: {userObj?.reservationCount ?? 0}건</span>
                          </div>
                          {/* 예약 서비스(타입) - 표준화된 타입별 건수로 표시 */}
                          {userObj?.reservationTypeCounts?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {userObj.reservationTypeCounts.map((t: { type: string; count: number }, idx: number) => {
                                const s = t.type;
                                let color = 'bg-gray-100 text-gray-700 border-gray-200';
                                if (s === 'cruise' || s === 'room') color = 'bg-blue-50 text-blue-600 border-blue-200';
                                else if (s === 'car') color = 'bg-green-50 text-green-600 border-green-200';
                                else if (s === 'airport') color = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                                else if (s === 'hotel') color = 'bg-purple-50 text-purple-600 border-purple-200';
                                else if (s === 'tour') color = 'bg-orange-50 text-orange-600 border-orange-200';
                                else if (s === 'rentcar') color = 'bg-gray-200 text-gray-700 border-gray-300';
                                return (
                                  <span key={idx} className={`px-2 py-0.5 rounded text-[11px] border font-semibold ${color}`}>
                                    {s} <span className="text-[10px] text-gray-500">({t.count}건)</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-2 text-center">
                          ID: {userGroup.userInfo.id}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* 단일 팝업 모달 - 사용자 상세 */}
        {showModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <User className="w-8 h-8 p-1.5 bg-blue-100 text-blue-600 rounded-full" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">
                        {selectedUser.userInfo.name}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {selectedUser.userInfo.email}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">ID: {selectedUser.userInfo.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">사용자 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-700">이름</div>
                    <div className="text-lg font-bold text-gray-900">{selectedUser.userInfo.name}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-700">이메일</div>
                    <div className="text-lg font-bold text-gray-900">{selectedUser.userInfo.email}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                    <div className="text-sm text-gray-700">ID</div>
                    <div className="text-lg font-bold text-gray-900">{selectedUser.userInfo.id}</div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t bg-gray-50">
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

