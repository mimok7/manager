'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import { useAuth } from '@/hooks/useAuth';

export default function CustomerManagement() {
  const [customerCount, setCustomerCount] = useState<number | null>(null);

  const router = useRouter();
    const { loading: authLoading, isManager } = useAuth(['manager', 'admin'], '/');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');

  // 실제 표시되는 고객: roleFilter에 따라 클라이언트에서도 필터링 (정규화된 비교)
  const normalizedRoleFilter = String(roleFilter ?? 'all').trim().toLowerCase();
  const filteredCustomers = customers.filter((c) => {
    const r = String(c?.role ?? '').trim().toLowerCase();
    return normalizedRoleFilter === 'all' || r === normalizedRoleFilter;
  });

  useEffect(() => {
    
  }, []);

  useEffect(() => {
    if (user) {
      loadCustomers();
    }
  }, [user, searchTerm, sortBy, sortOrder, roleFilter]);

  // checkAuth 제거됨 - useAuth 훅 사용

  const loadCustomers = async () => {
    try {
      console.log('👥 고객 데이터 로딩 시작...');
      console.log('🔍 검색어:', searchTerm || '없음', '정렬:', sortBy, sortOrder);




      // 역할 조건: 'all'이면 전체, 아니면 해당 역할만
      let query = supabase
        .from('users')
        .select('*', { count: 'exact', head: false });

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter).limit(2000);
      }

      // 검색어 적용
      if (searchTerm && searchTerm.trim()) {
        console.log('🔍 검색어 적용:', searchTerm);
        query = query.or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
      }

      // 정렬 적용
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data: customerData, error, count } = await query;

      console.log('📊 고객 조회 결과:');
      console.log('  - 고객 수:', customerData?.length || 0);
      console.log('  - 전체 행 수(count):', count);
      console.log('  - 오류:', error?.message || '없음');

      if (error) {
        console.error('❌ 고객 데이터 조회 실패:', error);
        setCustomers([]);
        return;
      }

      if (!customerData || customerData.length === 0) {
        console.log('📭 고객 데이터 없음');
        setCustomers([]);
        return;
      }

      console.log('✅ 고객 데이터 발견:', customerData.length, '명');

      // 서버에서 받아온 role 값은 대소문자/공백이 섞여올 수 있으므로 정규화해서 저장
      const normalized = customerData.map((c: any) => ({
        ...c,
        role: String(c?.role ?? '').trim().toLowerCase()
      }));

      console.log('🔎 수신된 role 목록:', Array.from(new Set(normalized.map((c: any) => c.role))).join(', '));

      // 통계 없이 고객 리스트만 바로 세팅
      setCustomers(normalized);
      setCustomerCount(count ?? normalized.length);

    } catch (error) {
      console.error('❌ 고객 로드 완전 실패:', error);
      setCustomers([]);
    }
  };

  const viewCustomerDetail = async (customerId: string) => {
    try {
      // 고객 상세 정보 조회
      const { data: customer } = await supabase
        .from('users')
        .select('*')
        .eq('id', customerId)
        .single();

      // 고객의 견적 목록 조회
      const { data: quotes } = await supabase
        .from('quote')
        .select(`
          *,
          schedule_info!quote_schedule_code_fkey(name),
          cruise_info!quote_cruise_code_fkey(name),
          payment_info!quote_payment_code_fkey(name)
        `)
        .eq('user_id', customerId)
        .order('created_at', { ascending: false });

      setSelectedCustomer({
        ...customer,
        quotes: quotes || []
      });
      setShowModal(true);
    } catch (error) {
      console.error('고객 상세 정보 로드 실패:', error);
    }
  };

  const updateCustomerInfo = async (customerId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', customerId);

      if (error) throw error;

      alert('고객 정보가 업데이트되었습니다.');
      loadCustomers();
      setShowModal(false);
    } catch (error) {
      console.error('고객 정보 업데이트 실패:', error);
      alert('업데이트에 실패했습니다.');
    }
  };

  const getActivityBadge = (lastStatus: string, lastActivity: string) => {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince <= 7) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">활성</span>;
    } else if (daysSince <= 30) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">보통</span>;
    } else {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">비활성</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-lg text-gray-600">로딩 중...</div>
    </div>;
  }

  return (
    <ManagerLayout title="👥 고객 관리" activeTab="customers">
      <div className="space-y-6">
        {/* 검색 및 정렬 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="고객 이름 또는 이메일로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            {/* 정렬 기준 버튼 그룹 */}
            <div className="flex gap-2">
              {[
                { label: '가입일', value: 'created_at' },
                { label: '이름', value: 'name' },
                { label: '이메일', value: 'email' }
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`px-3 py-2 rounded-md text-sm border border-gray-200 transition-all ${sortBy === opt.value
                    ? 'bg-blue-50 text-blue-600 font-bold border-blue-400'
                    : 'bg-white text-gray-600 hover:bg-blue-50'
                    }`}
                  onClick={() => setSortBy(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* 구분선 */}
            <span className="mx-2 text-gray-300 text-lg font-bold select-none">|</span>
            {/* 정렬 방향 버튼 그룹 */}
            <div className="flex gap-2">
              <button
                className={`px-3 py-2 rounded-md text-sm border border-gray-200 transition-all ${sortOrder === 'desc'
                  ? 'bg-blue-50 text-blue-600 font-bold border-blue-400'
                  : 'bg-white text-gray-600 hover:bg-blue-50'
                  }`}
                onClick={() => setSortOrder('desc')}
              >내림차순</button>
              <button
                className={`px-3 py-2 rounded-md text-sm border border-gray-200 transition-all ${sortOrder === 'asc'
                  ? 'bg-blue-50 text-blue-600 font-bold border-blue-400'
                  : 'bg-white text-gray-600 hover:bg-blue-50'
                  }`}
                onClick={() => setSortOrder('asc')}
              >오름차순</button>
            </div>
            {/* 권한 필터 버튼 그룹 */}
            <span className="mx-2 text-gray-300 text-lg font-bold select-none">|</span>
            <div className="flex gap-2">
              {[
                { label: '전체', value: 'all' },
                { label: 'member', value: 'member' },
                { label: 'guest', value: 'guest' },
                { label: 'user', value: 'user' },
                { label: 'manager', value: 'manager' },
                { label: 'admin', value: 'admin' },
                { label: 'dispatcher', value: 'dispatcher' }
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`px-3 py-2 rounded-md text-sm border border-gray-200 transition-all ${(typeof roleFilter !== 'undefined' ? roleFilter : 'all') === opt.value
                    ? 'bg-green-50 text-green-600 font-bold border-green-400'
                    : 'bg-white text-gray-600 hover:bg-green-50'
                    }`}
                  onClick={() => setRoleFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 고객 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">총 고객 수</div>
            <div className="text-2xl font-bold text-gray-900">{customerCount ?? filteredCustomers.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">활성 고객</div>
            <div className="text-2xl font-bold text-green-600">
              {filteredCustomers.filter(c => {
                const daysSince = c.last_activity ? Math.floor((Date.now() - new Date(c.last_activity).getTime()) / (1000 * 60 * 60 * 24)) : 9999;
                return daysSince <= 7;
              }).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">예약 고객</div>
            <div className="text-2xl font-bold text-blue-600">
              {filteredCustomers.filter(c => c.confirmed_count && c.confirmed_count > 0).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">신규 고객 (30일)</div>
            <div className="text-2xl font-bold text-purple-600">
              {filteredCustomers.filter(c => {
                const daysSince = c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 9999;
                return daysSince <= 30;
              }).length}
            </div>
          </div>
        </div>

        {/* 고객 목록 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {customers.length === 0 ? (
            <div className="py-8 text-center text-gray-500">고객이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {customers
                .filter((customer) => roleFilter === 'all' || customer.role === roleFilter)
                .map((customer) => (
                  <div key={customer.id} className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between h-full">
                    <div className="mb-2">
                      <div className="text-base font-semibold text-gray-900">{customer.name || '이름 없음'}</div>
                      <div className="text-sm text-gray-500">{customer.email}</div>
                      {customer.phone_number && (
                        <div className="text-xs text-gray-400 mt-1">{customer.phone_number}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {/* 모든 컬럼 동적 표시 */}
                      {['name', 'nickname', 'role', 'created_at', 'updated_at'].map((key) => {
                        const labelMap: Record<string, string> = {
                          name: '영문이름',
                          nickname: '닉네임',
                          role: '권한',
                          created_at: '가입일',
                          updated_at: '수정일',
                        };
                        const label = labelMap[key] || key;
                        let value = customer[key] ?? '';
                        if (key === 'name' && customer.english_name) {
                          value = customer.english_name;
                        }
                        return (
                          <div key={key} className="mb-1">
                            <span className="font-semibold text-gray-500">{label}:</span> <span className="text-gray-700">{String(value)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-end mt-2">
                      <button
                        onClick={() => viewCustomerDetail(customer.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs md:text-sm"
                      >상세보기</button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      {/* 고객 상세 모달 */}
      {showModal && selectedCustomer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/4 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">고객 상세 정보</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">이름</label>
                  <input
                    type="text"
                    defaultValue={selectedCustomer.name || ''}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    onBlur={(e) => {
                      if (e.target.value !== selectedCustomer.name) {
                        updateCustomerInfo(selectedCustomer.id, { name: e.target.value });
                      }
                    }}
                  />
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700">권한</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                    value={selectedCustomer.role}
                    onChange={e => updateCustomerInfo(selectedCustomer.id, { role: e.target.value })}
                  >
                    <option value="guest">게스트</option>
                    <option value="member">회원</option>
                    <option value="manager">매니저</option>
                    <option value="admin">관리자</option>
                    <option value="dispatcher">배차 담당자</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={selectedCustomer.email}
                    disabled
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">견적 이력</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                    {selectedCustomer.quotes?.length > 0 ? (
                      selectedCustomer.quotes.map((quote: any) => (
                        <div key={quote.id} className="p-3 border-b border-gray-100 last:border-b-0">
                          <div className="text-sm font-medium">
                            {quote.schedule_info?.name} • {quote.cruise_info?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            체크인: {formatDate(quote.checkin)} • 상태: {quote.status}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-gray-500">견적 이력이 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}


// 드롭다운 메뉴를 버튼으로 변경 (컴포넌트 내보내기)

export function CustomerMenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block text-left">
      <button
        className="btn bg-blue-50 border border-gray-200 px-3 py-2 rounded-lg shadow-sm text-gray-600 flex items-center"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        고객 관리 메뉴
        <svg className="ml-2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 20 20">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
            onClick={() => { window.location.href = "/manager/customers"; setOpen(false); }}
          >고객 목록</button>
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
            onClick={() => { window.location.href = "/manager/customers/new"; setOpen(false); }}
          >신규 등록</button>
          {/* 필요시 메뉴 추가 */}
        </div>
      )}
    </div>
  );
}

