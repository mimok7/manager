'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';

// 타입 정의
interface BaseNotification {
  id: string;
  type: 'business' | 'customer';
  category: string;
  subcategory?: string; // 서브카테고리 추가
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'unread' | 'read' | 'processing' | 'completed' | 'dismissed';
  target_id?: string;
  target_table?: string;
  assigned_to?: string;
  due_date?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  processed_by_name?: string; // 처리 매니저 이름
  customer_details?: any[]; // 조인된 customer_notifications 데이터
  customer_name?: string; // 고객 이름 추가
  customer_email?: string; // 고객 이메일 추가
  customer_phone?: string; // 고객 전화번호 추가
}

interface CustomerNotification extends BaseNotification {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  inquiry_type?: string;
  service_type?: string;
  response_deadline?: string;
  customer_satisfaction?: number;
  follow_up_required?: boolean;
  resolution_notes?: string;
}

type NotificationItem = BaseNotification | CustomerNotification;

// 한글 컬럼명 매핑
const getKoreanFieldName = (field: string): string => {
  const fieldMap: Record<string, string> = {
    'type': '유형',
    'category': '카테고리',
    'title': '제목',
    'message': '내용',
    'priority': '우선순위',
    'status': '상태',
    'created_at': '생성일시',
    'updated_at': '수정일시',
    'processed_at': '처리일시',
  };
  return fieldMap[field] || field;
};

const getKoreanStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'unread': '읽지않음',
    'read': '읽음',
    'processing': '처리중',
    'completed': '완료',
    'dismissed': '무시됨'
  };
  return statusMap[status] || status;
};

const getKoreanPriority = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    'low': '낮음',
    'normal': '보통',
    'high': '높음',
    'urgent': '긴급'
  };
  return priorityMap[priority] || priority;
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-600';
    case 'high': return 'bg-orange-100 text-orange-600';
    case 'normal': return 'bg-blue-100 text-blue-600';
    case 'low': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'unread': return 'bg-red-100 text-red-600';
    case 'read': return 'bg-blue-100 text-blue-600';
    case 'processing': return 'bg-yellow-100 text-yellow-600';
    case 'completed': return 'bg-green-100 text-green-600';
    case 'dismissed': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export default function NotificationManagement() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [customerNotifications, setCustomerNotifications] = useState<any[]>([]);

  // 실시간 알림 팝업 상태
  const [popupNotifications, setPopupNotifications] = useState<NotificationItem[]>([]);
  const [showPopup, setShowPopup] = useState(false);

  // 필터 상태
  const [activeTab, setActiveTab] = useState<'business' | 'customer' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('unread');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // 카테고리 필터 추가

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // 알림 처리 상태
  const [processingNote, setProcessingNote] = useState('');
  const [customerSatisfaction, setCustomerSatisfaction] = useState<number>(5);

  // 통계 데이터
  const [stats, setStats] = useState({
    total: 0,
    quote: 0,      // 견적
    reservation: 0, // 예약
    payment: 0,     // 결제
    customer: 0,    // 고객
    unread: 0,      // 읽지않음
    urgent: 0       // 긴급
  });

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        loadNotifications();
        loadStats();
      }
    }
    init();
  }, [activeTab, statusFilter, priorityFilter, categoryFilter]);

  // 별도의 1분 갱신 타이머 (필터 변경과 무관)
  useEffect(() => {
    const interval = setInterval(() => {
      loadNotifications();
      loadStats();
    }, 60000); // 1분마다

    return () => clearInterval(interval);
  }, []); // 빈 의존성으로 1부만 설정

  // checkAuth 함수 제거 - useAuth 훅으로 대체됨

  const loadNotifications = async () => {
    try {
      setLoading(true);

      // 1. 업무 알림 조회 (notifications 테이블에서 business 타입)
      let businessQuery = supabase
        .from('notifications')
        .select('*')
        .eq('type', 'business')
        .order('created_at', { ascending: false });

      // 2. 고객 알림 조회 (notifications와 customer_notifications 조인)
      let customerQuery = supabase
        .from('notifications')
        .select(`
                    *,
                    customer_details:customer_notifications(
                        customer_name,
                        customer_phone,
                        customer_email,
                        inquiry_type,
                        service_type,
                        customer_satisfaction,
                        follow_up_required,
                        resolution_notes
                    )
                `)
        .eq('type', 'customer')
        .order('created_at', { ascending: false });

      // 상태별 필터링
      if (statusFilter !== 'all') {
        businessQuery = businessQuery.eq('status', statusFilter);
        customerQuery = customerQuery.eq('status', statusFilter);
      }

      // 우선순위별 필터링  
      if (priorityFilter !== 'all') {
        businessQuery = businessQuery.eq('priority', priorityFilter);
        customerQuery = customerQuery.eq('priority', priorityFilter);
      }

      // 카테고리별 필터링 추가
      if (categoryFilter !== 'all') {
        businessQuery = businessQuery.eq('category', categoryFilter);
        customerQuery = customerQuery.eq('category', categoryFilter);
      }

      // 결제 알림도 함께 조회
      let paymentQuery = supabase
        .from('payment_notifications')
        .select('*')
        .order('notification_date', { ascending: false });

      if (statusFilter !== 'all') {
        // payment_notifications는 is_sent로 상태를 관리하므로 매핑
        if (statusFilter === 'unread') paymentQuery = paymentQuery.eq('is_sent', false);
        if (statusFilter === 'read') paymentQuery = paymentQuery.eq('is_sent', true);
      }

      const [businessResult, customerResult, paymentResult] = await Promise.all([
        businessQuery,
        customerQuery,
        paymentQuery
      ]);

      if (businessResult.error) {
        console.log('📋 notifications 테이블 오류:', businessResult.error.message);
      }
      if (customerResult.error) {
        console.log('📋 고객 알림 조회 오류:', customerResult.error.message);
      }

      const businessNotifications = businessResult.data || [];
      const customerNotifications = customerResult.data || [];
      const paymentNotifications = (paymentResult && paymentResult.data) || [];

      // 통합 알림 목록 생성
      let allNotifications: NotificationItem[] = [];

      // 탭별 필터링
      if (activeTab === 'business' || activeTab === 'all') {
        allNotifications.push(...businessNotifications.map(n => ({
          ...n,
          type: 'business' as const
        })));

        // payment_notifications 를 업무 알림으로 펼쳐서 표시 (카테고리 필터 존중)
        if (categoryFilter === 'all' || categoryFilter === '결제') {
          allNotifications.push(...paymentNotifications.map((pn: any) => ({
            id: pn.id,
            type: 'business' as const,
            category: '결제',
            title: pn.notification_type === 'payment_due' ? '결제 예정 알림' : pn.notification_type === 'payment_overdue' ? '결제 연체 알림' : pn.notification_type,
            message: pn.message_content || pn.message || '',
            priority: (pn.priority || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
            status: (pn.is_sent ? 'read' : 'unread') as 'unread' | 'read' | 'processing' | 'completed' | 'dismissed',
            target_table: 'reservation',
            target_id: pn.reservation_id ? String(pn.reservation_id) : undefined,
            notification_date: pn.notification_date,
            created_at: pn.created_at || (pn.notification_date ? (new Date(pn.notification_date)).toISOString() : new Date().toISOString()),
            updated_at: pn.sent_at || pn.created_at || new Date().toISOString(),
            metadata: { reservation_id: pn.reservation_id }
          })));
        }
      }
      if (activeTab === 'customer' || activeTab === 'all') {
        allNotifications.push(...customerNotifications.map(n => ({
          ...n,
          type: 'customer' as const,
          // customer_details 정보를 최상위로 펼치기
          ...(n.customer_details && n.customer_details[0] ? n.customer_details[0] : {})
        })));
      }

      // 시간순 정렬
      allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // 안전망: 최종 카테고리 클라이언트 필터 (DB/병합 단계에서 누락된 항목 차단)
      if (categoryFilter !== 'all') {
        allNotifications = allNotifications.filter((n) => n.category === categoryFilter);
      }

      setNotifications(allNotifications);
      setCustomerNotifications(customerNotifications);

      // 실시간 알림 팝업 체크 (읽지않은 긴급 알림)
      const urgentUnread = allNotifications.filter(n =>
        n.status === 'unread' && n.priority === 'urgent'
      );
      if (urgentUnread.length > 0) {
        setPopupNotifications(urgentUnread);
        setShowPopup(true);
      }

      console.log(`✅ 알림 로드 완료: 업무 ${businessNotifications.length}개, 고객 ${customerNotifications.length}개`);
    } catch (error) {
      console.error('알림 로드 실패:', error);
      setNotifications([]);
      setCustomerNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // 통계 데이터 로드
      const { data: allNotifications } = await supabase
        .from('notifications')
        .select('*');

      const notiData = allNotifications || [];

      setStats({
        total: notiData.length,
        quote: notiData.filter(n => n.category === '견적' || n.title?.includes('견적')).length,
        reservation: notiData.filter(n => n.category === '예약' || n.title?.includes('예약')).length,
        payment: notiData.filter(n => n.category === '결제' || n.title?.includes('결제')).length,
        customer: notiData.filter(n => n.type === 'customer' || n.category === '고객문의').length,
        unread: notiData.filter(n => n.status === 'unread').length,
        urgent: notiData.filter(n => n.priority === 'urgent').length
      });
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  };

  // 알림 처리 상태 업데이트
  const updateNotificationStatus = async (notificationId: string, status: 'read' | 'processing' | 'completed') => {
    try {
      const { data, error } = await supabase.rpc('complete_notification', {
        p_notification_id: notificationId,
        p_manager_id: user?.id || '',
        p_manager_name: userProfile?.name || user?.email || '매니저',
        p_processing_note: processingNote || '',
        p_customer_satisfaction: status === 'completed' ? customerSatisfaction : null
      });

      if (error) throw error;

      // 로컬 상태 업데이트
      setNotifications(prev => prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, status, updated_at: new Date().toISOString() }
          : notification
      ));

      setProcessingNote('');
      setCustomerSatisfaction(5);

      console.log(`✅ 알림 처리 완료: ${notificationId} → ${status}`);
    } catch (error) {
      console.error('❌ 알림 처리 실패:', error);
      alert('알림 처리에 실패했습니다.');
    }
  };

  // 실시간 알림 팝업 닫기
  const dismissPopup = async (notificationId?: string) => {
    if (notificationId) {
      await updateNotificationStatus(notificationId, 'read');
      setPopupNotifications(prev => prev.filter(n => n.id !== notificationId));
    }

    if (!notificationId || popupNotifications.length <= 1) {
      setShowPopup(false);
      setPopupNotifications([]);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    setSelectedNotification(notification);
    setShowModal(true);

    // 읽지 않음 상태면 읽음으로 변경
    if (notification.status === 'unread') {
      updateNotificationStatus(notification.id, 'read');
    }
  };

  if (loading) {
    return (
      <ManagerLayout title="알림 관리" activeTab="notifications">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">알림을 불러오는 중...</p>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="📬 알림 관리" activeTab="notifications">
      <div className="space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${categoryFilter === 'all' ? 'ring-2 ring-blue-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">전체</div>
            </div>
          </button>

          <button
            onClick={() => setCategoryFilter('견적')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${categoryFilter === '견적' ? 'ring-2 ring-blue-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.quote}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">견적</div>
            </div>
          </button>

          <button
            onClick={() => setCategoryFilter('예약')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${categoryFilter === '예약' ? 'ring-2 ring-blue-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.reservation}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">예약</div>
            </div>
          </button>

          <button
            onClick={() => setCategoryFilter('결제')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${categoryFilter === '결제' ? 'ring-2 ring-blue-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.payment}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">결제</div>
            </div>
          </button>

          <button
            onClick={() => setCategoryFilter('고객문의')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${categoryFilter === '고객문의' ? 'ring-2 ring-blue-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.customer}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">고객</div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('unread')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${statusFilter === 'unread' ? 'ring-2 ring-red-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.unread}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">읽지않음</div>
            </div>
          </button>

          <button
            onClick={() => setPriorityFilter('urgent')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${priorityFilter === 'urgent' ? 'ring-2 ring-red-500' : ''
              }`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
              <div className="text-sm font-medium text-gray-600 mt-1">긴급</div>
            </div>
          </button>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* 상태 필터 버튼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상태 필터</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  모든 상태
                </button>
                <button
                  onClick={() => setStatusFilter('unread')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'unread'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  읽지 않음
                </button>
                <button
                  onClick={() => setStatusFilter('read')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'read'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  읽음
                </button>
                <button
                  onClick={() => setStatusFilter('processing')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'processing'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  처리중
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'completed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  완료
                </button>
              </div>
            </div>

            {/* 우선순위 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">우선순위 필터</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPriorityFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${priorityFilter === 'all'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  모든 우선순위
                </button>
                <button
                  onClick={() => setPriorityFilter('urgent')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${priorityFilter === 'urgent'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  긴급
                </button>
                <button
                  onClick={() => setPriorityFilter('high')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${priorityFilter === 'high'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  높음
                </button>
                <button
                  onClick={() => setPriorityFilter('normal')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${priorityFilter === 'normal'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  보통
                </button>
                <button
                  onClick={() => setPriorityFilter('low')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${priorityFilter === 'low'
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  낮음
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 알림 목록 - 외부 3열 카드 레이아웃 */}
        <div>
          {notifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <span className="text-4xl mb-4 block">📭</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">알림이 없습니다</h3>
              <p className="text-gray-600">새로운 알림이 도착하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow-sm p-5 cursor-pointer transition transform hover:-translate-y-0.5 hover:shadow-md ${notification.status === 'unread' ? 'ring-2 ring-blue-100' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                          {notification.priority === 'urgent' && '🚨 '}
                          {notification.priority === 'high' && '⚡ '}
                          {notification.priority === 'normal' && '📋 '}
                          {notification.priority === 'low' && '📄 '}
                          {getKoreanPriority(notification.priority)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(notification.status)}`}>
                          {notification.status === 'unread' && '🔴 '}
                          {notification.status === 'read' && '👁️ '}
                          {notification.status === 'processing' && '⚙️ '}
                          {notification.status === 'completed' && '✅ '}
                          {notification.status === 'dismissed' && '❌ '}
                          {getKoreanStatus(notification.status)}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                          {notification.type === 'business' ? '💼 업무' : '👥 고객'}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 rounded-full text-xs font-medium text-purple-600">
                          {notification.category}
                        </span>
                      </div>

                      <h3 className="text-md font-semibold text-gray-900 mb-2 line-clamp-2">{notification.title}</h3>

                      {(notification.customer_name || notification.customer_email) && (
                        <div className="bg-blue-50 rounded-lg p-2 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-600 font-medium">👤 고객정보:</span>
                            {notification.customer_name && (
                              <span className="text-gray-800">{notification.customer_name}</span>
                            )}
                            {notification.customer_email && (
                              <span className="text-blue-600">📧 {notification.customer_email}</span>
                            )}
                          </div>
                        </div>
                      )}

                      <p className="text-gray-600 text-sm line-clamp-3 mb-3">{notification.message}</p>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div>{new Date(notification.created_at).toLocaleString('ko-KR')}</div>
                        <div className="flex items-center space-x-2">
                          {notification.assigned_to && (
                            <span className="text-xs text-blue-600">담당자: {notification.assigned_to}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 알림 상세 모달 */}
        {showModal && selectedNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">알림 상세 정보</h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedNotification.priority)}`}>
                      {getKoreanPriority(selectedNotification.priority)}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedNotification.status)}`}>
                      {getKoreanStatus(selectedNotification.status)}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                      {selectedNotification.type === 'business' ? '💼 업무' : '👥 고객'}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 rounded-full text-xs font-medium text-purple-600">
                      {selectedNotification.category}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">{getKoreanFieldName('title')}</h4>
                    <p className="text-gray-700">{selectedNotification.title}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">{getKoreanFieldName('message')}</h4>
                    <div className="text-gray-700">
                      {(() => {
                        const message = selectedNotification.message;

                        // 정규식으로 각 항목 추출
                        const customerNameMatch = message.match(/고객명:\s*([^\s]+)/);
                        const serviceMatch = message.match(/서비스:\s*([^\s]+)/);
                        const quoteNameMatch = message.match(/견적명:\s*([^\s]+(?:\s+\d+)?)/);
                        const amountMatch = message.match(/예약\s+금액:\s*([^\s]+)/);
                        const statusMatch = message.match(/예약\s+상태:\s*([^\s]+)/);

                        // 추출된 데이터로 나머지 메시지 생성
                        let remainingText = message
                          .replace(/고객명:\s*[^\s]+\s*/g, '')
                          .replace(/이메일:\s*[^\s]+\s*/g, '')
                          .replace(/연락처:\s*[^\s]+\s*/g, '')
                          .replace(/서비스:\s*[^\s]+\s*/g, '')
                          .replace(/견적명:\s*[^\s]+(?:\s+\d+)?\s*/g, '')
                          .replace(/예약\s+금액:\s*[^\s]+\s*/g, '')
                          .replace(/예약\s+상태:\s*[^\s]+\s*/g, '')
                          .trim();

                        // 파싱된 데이터가 있으면 구조화해서 표시
                        if (customerNameMatch || serviceMatch || quoteNameMatch) {
                          return (
                            <div className="space-y-1">
                              {customerNameMatch && <div><span className="font-medium">고객명:</span> {customerNameMatch[1]}</div>}
                              {serviceMatch && <div><span className="font-medium">서비스:</span> {serviceMatch[1]}</div>}
                              {quoteNameMatch && <div><span className="font-medium">견적명:</span> {quoteNameMatch[1]}</div>}
                              {amountMatch && <div><span className="font-medium">예약 금액:</span> {amountMatch[1]}</div>}
                              {statusMatch && <div><span className="font-medium">예약 상태:</span> {statusMatch[1]}</div>}
                              {remainingText && <div className="mt-2">{remainingText}</div>}
                            </div>
                          );
                        }

                        // 파싱할 수 없으면 원본 메시지 표시
                        return <p className="whitespace-pre-line">{message}</p>;
                      })()}
                    </div>
                  </div>

                  {/* 고객 정보 표시 (고객 알림인 경우) */}
                  {selectedNotification.type === 'customer' && selectedNotification.customer_details && selectedNotification.customer_details[0] && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">👤 고객 정보</h4>
                      <div className="space-y-1 text-sm">
                        <div><span className="font-medium">이름:</span> {selectedNotification.customer_details[0].customer_name || '이름 정보 없음'}</div>
                        <div><span className="font-medium">이메일:</span> {selectedNotification.customer_details[0].customer_email || '이메일 정보 없음'}</div>
                        <div><span className="font-medium">연락처:</span> {selectedNotification.customer_details[0].customer_phone || '연락처 정보 없음'}</div>
                        <div><span className="font-medium">문의 유형:</span> {selectedNotification.customer_details[0].inquiry_type || '-'}</div>
                        <div><span className="font-medium">서비스 유형:</span> {selectedNotification.customer_details[0].service_type || '-'}</div>
                      </div>
                    </div>
                  )}

                  {/* 처리 매니저 정보 표시 (완료된 경우) */}
                  {selectedNotification.status === 'completed' && selectedNotification.processed_by_name && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">✅ 처리 정보</h4>
                      <div className="space-y-1 text-sm">
                        <div><span className="font-medium">처리 매니저:</span> {selectedNotification.processed_by_name}</div>
                        {selectedNotification.processed_at && (
                          <div><span className="font-medium">처리 완료:</span> {new Date(selectedNotification.processed_at).toLocaleString('ko-KR')}</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">{getKoreanFieldName('created_at')}:</span>
                      <p className="text-gray-800">{new Date(selectedNotification.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    {selectedNotification.processed_at && (
                      <div>
                        <span className="font-medium text-gray-600">{getKoreanFieldName('processed_at')}:</span>
                        <p className="text-gray-800">{new Date(selectedNotification.processed_at).toLocaleString('ko-KR')}</p>
                      </div>
                    )}
                  </div>

                  {/* 처리 메모 입력 */}
                  {selectedNotification.status !== 'completed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        처리 메모
                      </label>
                      <textarea
                        value={processingNote}
                        onChange={(e) => setProcessingNote(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="처리 내용을 입력하세요..."
                      />
                    </div>
                  )}

                  {/* 고객 만족도 (고객 알림인 경우) */}
                  {selectedNotification.type === 'customer' && selectedNotification.status !== 'completed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        고객 만족도 (1-5점)
                      </label>
                      <select
                        value={customerSatisfaction}
                        onChange={(e) => setCustomerSatisfaction(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={5}>5점 (매우 만족)</option>
                        <option value={4}>4점 (만족)</option>
                        <option value={3}>3점 (보통)</option>
                        <option value={2}>2점 (불만족)</option>
                        <option value={1}>1점 (매우 불만족)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={async () => {
                      await updateNotificationStatus(selectedNotification.id, 'processing');
                      setShowModal(false);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    처리
                  </button>

                  {selectedNotification.status === 'processing' && (
                    <button
                      onClick={() => updateNotificationStatus(selectedNotification.id, 'completed')}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      처리 완료
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 실시간 알림 팝업 */}
        {showPopup && popupNotifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {popupNotifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-red-500 text-white rounded-lg shadow-lg p-4 max-w-sm animate-slideInRight"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">🚨</span>
                    <span className="font-bold text-sm">{getKoreanPriority(notification.priority)} 알림</span>
                  </div>
                  <button
                    onClick={() => dismissPopup(notification.id)}
                    className="text-white hover:text-gray-200 ml-2"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-2">
                  <div className="font-medium text-sm">{notification.title}</div>
                  <div className="text-xs opacity-90 mt-1 line-clamp-2">{notification.message}</div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="opacity-75">{getKoreanFieldName('type')}: {notification.type === 'business' ? '업무' : '고객'}</span>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => {
                        setSelectedNotification(notification);
                        setShowModal(true);
                        dismissPopup(notification.id);
                      }}
                      className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs hover:bg-opacity-30"
                    >
                      상세보기
                    </button>
                    <button
                      onClick={async () => {
                        await updateNotificationStatus(notification.id, 'processing');
                        dismissPopup(notification.id);
                      }}
                      className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs hover:bg-opacity-30"
                    >
                      처리하기
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {popupNotifications.length > 1 && (
              <div className="bg-gray-800 text-white rounded-lg p-2 text-center">
                <button
                  onClick={() => dismissPopup()}
                  className="text-xs hover:text-gray-300"
                >
                  모든 알림 닫기 ({popupNotifications.length}개)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
