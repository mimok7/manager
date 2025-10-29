
'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import {
  BarChart3,
  FileText,
  Calendar,
  CreditCard,
  CheckSquare,
  TrendingUp,
  Users,
  DollarSign,
  Ship,
  Plane,
  Building,
  MapPin,
  Car,
  RefreshCw
} from 'lucide-react';

type TabType = 'quotes' | 'reservations' | 'payments' | 'confirmations';

interface AnalyticsData {
  quotes?: any;
  reservations?: any;
  payments?: any;
  confirmations?: any;
}

export default function ManagerAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('quotes');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const tabs = [
    { id: 'quotes' as TabType, label: '견적 분석', icon: <FileText className="w-4 h-4" />, color: 'blue' },
    { id: 'reservations' as TabType, label: '예약 분석', icon: <Calendar className="w-4 h-4" />, color: 'green' },
    { id: 'payments' as TabType, label: '결제 분석', icon: <CreditCard className="w-4 h-4" />, color: 'purple' },
    { id: 'confirmations' as TabType, label: '확인서 분석', icon: <CheckSquare className="w-4 h-4" />, color: 'orange' }
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, [activeTab]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      console.log('📊 분석 데이터 조회 시작:', activeTab);

      // 날짜 범위 설정 (최근 30일)
      const now = new Date();
      const last30Days = new Date();
      last30Days.setDate(now.getDate() - 30);

      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        return { key, date: new Date(key), count: 0 };
      });

      let tabData: any = {};

      switch (activeTab) {
        case 'quotes':
          // 서버 집계 RPC 호출 (전체 데이터 기반)
          {
            const { data, error } = await supabase.rpc('analytics_quotes_summary');
            if (error) {
              console.error('견적 집계 RPC 오류:', error);
            }
            const d: any = data || {};
            // 방어적 기본값
            d.byStatus = {
              approved: d?.byStatus?.approved ?? 0,
              pending: d?.byStatus?.pending ?? 0,
              draft: d?.byStatus?.draft ?? 0,
              rejected: d?.byStatus?.rejected ?? 0,
            };
            // ⏱️ 일 단위 지표 계산 (오늘 생성/오늘 승인)
            try {
              const start = new Date();
              start.setHours(0, 0, 0, 0);
              const end = new Date(start);
              end.setDate(start.getDate() + 1);

              const [todayCreatedRes, todayApprovedRes] = await Promise.all([
                supabase
                  .from('quote')
                  .select('*', { count: 'exact', head: true })
                  .gte('created_at', start.toISOString())
                  .lt('created_at', end.toISOString()),
                supabase
                  .from('quote')
                  .select('*', { count: 'exact', head: true })
                  .eq('status', 'approved')
                  .gte('approved_at', start.toISOString())
                  .lt('approved_at', end.toISOString()),
              ]);

              const todayCount = Number(todayCreatedRes.count) || 0;
              const todayApproved = Number(todayApprovedRes.count) || 0;
              const todayApprovalRate = todayCount > 0 ? Math.round((todayApproved / todayCount) * 100) : 0;

              d.todayCount = todayCount;
              d.todayApproved = todayApproved;
              d.todayApprovalRate = todayApprovalRate;
            } catch (e) {
              console.warn('오늘 지표 계산 경고:', e);
              d.todayCount = d.todayCount ?? 0;
              d.todayApproved = d.todayApproved ?? 0;
              d.todayApprovalRate = d.todayApprovalRate ?? 0;
            }
            tabData = d;
          }
          break;

        case 'reservations':
          // 서버 집계 RPC 호출 (전체 데이터 기반)
          {
            const { data, error } = await supabase.rpc('analytics_reservations_summary');
            if (error) {
              console.error('예약 집계 RPC 오류:', error);
            }
            const d: any = data || {};
            d.byStatus = {
              confirmed: d?.byStatus?.confirmed ?? 0,
              pending: d?.byStatus?.pending ?? 0,
              cancelled: d?.byStatus?.cancelled ?? 0,
            };
            d.byType = d?.byType || {};
            // 색상은 프론트에서만 사용하므로 여기서 주입
            const monthColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-yellow-500', 'bg-gray-500', 'bg-cyan-500', 'bg-lime-500'];
            d.monthlyTrend = (d.monthlyTrend || []).map((m: any, i: number) => ({ ...m, color: monthColors[i % monthColors.length] }));
            tabData = d;
          }
          break;

        case 'payments':
          // 서버 집계 RPC 호출 (전체 데이터 기반)
          {
            const { data, error } = await supabase.rpc('analytics_payments_summary');
            if (error) {
              console.error('결제 집계 RPC 오류:', error);
            }
            const d: any = data || {};
            // 결제 수단 기본 키 보정
            d.byMethod = {
              card: d?.byMethod?.card ?? 0,
              transfer: d?.byMethod?.transfer ?? 0,
              cash: d?.byMethod?.cash ?? 0,
              ...Object.fromEntries(Object.entries(d?.byMethod || {}).filter(([k]) => !['card', 'transfer', 'cash'].includes(k)))
            };
            d.byStatus = {
              completed: d?.byStatus?.completed ?? 0,
              pending: d?.byStatus?.pending ?? 0,
              failed: d?.byStatus?.failed ?? 0,
            };
            tabData = d;
          }
          break;

        case 'confirmations':
          // 서버 집계 RPC 호출 (전체 데이터 기반)
          {
            const { data, error } = await supabase.rpc('analytics_confirmations_summary');
            if (error) {
              console.error('확인서 집계 RPC 오류:', error);
            }
            const d: any = data || {};
            d.byStatus = {
              sent: d?.byStatus?.sent ?? 0,
              pending: d?.byStatus?.pending ?? 0,
            };
            d.byType = d?.byType || {};
            tabData = d;
          }
          break;
      }

      setAnalyticsData(prev => ({
        quotes: undefined,
        reservations: undefined,
        payments: undefined,
        confirmations: undefined,
        ...prev,
        [activeTab]: tabData
      }));

    } catch (error) {
      console.error('🚨 분석 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'cruise': return <Ship className="w-4 h-4 text-blue-600" />;
      case 'airport': return <Plane className="w-4 h-4 text-green-600" />;
      case 'hotel': return <Building className="w-4 h-4 text-purple-600" />;
      case 'tour': return <MapPin className="w-4 h-4 text-orange-600" />;
      case 'rentcar': return <Car className="w-4 h-4 text-red-600" />;
      case 'car': return <Car className="w-4 h-4 text-red-600" />;
      case 'sht': return <Car className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'cruise': return '크루즈';
      case 'airport': return '공항';
      case 'hotel': return '호텔';
      case 'tour': return '투어';
      case 'rentcar': return '렌트카';
      case 'car': return '차량';
      case 'sht': return '스하차량';
      default: return type;
    }
  };

  const renderQuotesAnalytics = () => {
    const data = analyticsData?.quotes;
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* 주요 지표 (5열) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 견적</p>
                <p className="text-xl font-bold text-gray-800">{data.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">최근 30일</p>
                <p className="text-xl font-bold text-gray-800">{data.recent30}</p>
              </div>
            </div>
          </div>

          {/* 요청 반영: 금액 지표 제거 → 일 단위 지표로 대체 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">일 견적 건수</p>
                <p className="text-xl font-bold text-gray-800">{data.todayCount ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-100 rounded-lg">
                <CheckSquare className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">일 승인건수</p>
                <p className="text-xl font-bold text-gray-800">{data.todayApproved ?? 0}</p>
              </div>
            </div>
          </div>
          {/* 통계 (오늘 승인율) - 상단으로 이동 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">통계 (오늘 승인율)</p>
                <p className="text-xl font-bold text-gray-800">{(data.todayApprovalRate ?? 0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 견적 상태 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">견적 상태 분포</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>승인됨</span>
                </div>
                <span className="font-medium">{data.byStatus.approved}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>검토 대기</span>
                </div>
                <span className="font-medium">{data.byStatus.pending}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-500 rounded"></div>
                  <span>작성 중</span>
                </div>
                <span className="font-medium">{data.byStatus.draft}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>거부됨</span>
                </div>
                <span className="font-medium">{data.byStatus.rejected}건</span>
              </div>
            </div>
          </div>

          {/* 최근 7일 트렌드 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">최근 7일 견적 생성</h3>
            <div className="space-y-3">
              {data.trend7d?.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-12 text-sm text-gray-600">{new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${Math.max(5, (item.count / Math.max(...data.trend7d.map((t: any) => t.count))) * 100)}%`
                      }}
                    ></div>
                  </div>
                  <div className="w-8 text-sm font-medium text-right">{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReservationsAnalytics = () => {
    const data = analyticsData?.reservations;
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 예약</p>
                <p className="text-xl font-bold text-gray-800">{data.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">고객 수</p>
                <p className="text-xl font-bold text-gray-800">{data.customers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">최근 30일</p>
                <p className="text-xl font-bold text-gray-800">{data.recent30}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckSquare className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">확정</p>
                <p className="text-xl font-bold text-gray-800">{data.byStatus.confirmed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 예약 상태 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">예약 상태 분포</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>확정</span>
                </div>
                <span className="font-medium">{data.byStatus.confirmed}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>대기 중</span>
                </div>
                <span className="font-medium">{data.byStatus.pending}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>취소됨</span>
                </div>
                <span className="font-medium">{data.byStatus.cancelled}건</span>
              </div>
            </div>
          </div>

          {/* 서비스 타입별 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">서비스 타입별 예약</h3>
            <div className="space-y-3">
              {(() => {
                const byType = data.byType || {};
                const order = ['cruise', 'sht', 'car', 'airport', 'rentcar', 'hotel'];
                const orderedKeys = [
                  ...order.filter(t => byType[t] !== undefined),
                  ...Object.keys(byType).filter(t => !order.includes(t))
                ];
                return orderedKeys.map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getServiceIcon(type)}
                      <span>{getServiceLabel(type)}</span>
                    </div>
                    <span className="font-medium">{(byType[type] as number) ?? 0}건</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* 예약 활동 트렌드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 최근 7일 트렌드 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">최근 7일 예약 활동</h3>
            <div className="space-y-3">
              {data.trend7d?.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-12 text-sm text-gray-600">{new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${Math.max(5, (item.count / Math.max(...data.trend7d.map((t: any) => t.count))) * 100)}%`
                      }}
                    ></div>
                  </div>
                  <div className="w-8 text-sm font-medium text-right">{item.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 월별 예약 활동 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">월별 예약 활동</h3>
            <div className="space-y-3">
              {data.monthlyTrend?.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 text-sm text-gray-600">{item.month}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className={`${item.color} h-3 rounded-full transition-all duration-500`}
                      style={{
                        width: `${Math.max(5, (item.count / (data.maxMonthlyCount || 1)) * 100)}%`
                      }}
                    ></div>
                  </div>
                  <div className="w-10 text-sm font-medium text-right">{item.count}건</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-xs text-gray-500">
                <span>평균: {Math.round((data.monthlyTrend?.reduce((sum: number, m: any) => sum + m.count, 0) || 0) / (data.monthlyTrend?.length || 1))}건/월</span>
                <span>최고: {data.maxMonthlyCount || 0}건</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentsAnalytics = () => {
    const data = analyticsData?.payments;
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 결제</p>
                <p className="text-xl font-bold text-gray-800">{data.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 결제액</p>
                <p className="text-xl font-bold text-gray-800">{data.totalAmount.toLocaleString()}동</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">평균 결제액</p>
                <p className="text-xl font-bold text-gray-800">{data.avgAmount.toLocaleString()}동</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">최근 30일</p>
                <p className="text-xl font-bold text-gray-800">{data.recent30}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 결제 상태 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">결제 상태 분포</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>완료</span>
                </div>
                <span className="font-medium">{data.byStatus.completed}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>대기 중</span>
                </div>
                <span className="font-medium">{data.byStatus.pending}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>실패</span>
                </div>
                <span className="font-medium">{data.byStatus.failed}건</span>
              </div>
            </div>
          </div>

          {/* 결제 방법별 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">결제 방법별 분포</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>카드 결제</span>
                <span className="font-medium">{data.byMethod.card}건</span>
              </div>
              <div className="flex items-center justify-between">
                <span>계좌 이체</span>
                <span className="font-medium">{data.byMethod.transfer}건</span>
              </div>
              <div className="flex items-center justify-between">
                <span>현금</span>
                <span className="font-medium">{data.byMethod.cash}건</span>
              </div>
            </div>
          </div>
        </div>

        {/* 최근 7일 트렌드 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-base font-semibold mb-4">최근 7일 결제 활동</h3>
          <div className="space-y-3">
            {data.trend7d?.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-12 text-sm text-gray-600">{new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${Math.max(5, (item.count / Math.max(...data.trend7d.map((t: any) => t.count))) * 100)}%`
                    }}
                  ></div>
                </div>
                <div className="w-8 text-sm font-medium text-right">{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmationsAnalytics = () => {
    const data = analyticsData?.confirmations;
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <CheckSquare className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 확인서</p>
                <p className="text-xl font-bold text-gray-800">{data.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">최근 30일</p>
                <p className="text-xl font-bold text-gray-800">{data.recent30}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">발송 완료</p>
                <p className="text-xl font-bold text-gray-800">{data.byStatus.sent}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">발송 대기</p>
                <p className="text-xl font-bold text-gray-800">{data.byStatus.pending}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 확인서 타입별 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">확인서 타입별 분포</h3>
            <div className="space-y-4">
              {Object.entries(data.byType || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getServiceIcon(type)}
                    <span>{type}</span>
                  </div>
                  <span className="font-medium">{count as number}건</span>
                </div>
              ))}
            </div>
          </div>

          {/* 발송 상태 분포 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-base font-semibold mb-4">발송 상태 분포</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>발송 완료</span>
                </div>
                <span className="font-medium">{data.byStatus.sent}건</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>발송 대기</span>
                </div>
                <span className="font-medium">{data.byStatus.pending}건</span>
              </div>
            </div>
          </div>
        </div>

        {/* 최근 7일 트렌드 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-base font-semibold mb-4">최근 7일 확인서 발송</h3>
          <div className="space-y-3">
            {data.trend7d?.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-12 text-sm text-gray-600">{new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{
                      width: `${Math.max(5, (item.count / Math.max(...data.trend7d.map((t: any) => t.count))) * 100)}%`
                    }}
                  ></div>
                </div>
                <div className="w-8 text-sm font-medium text-right">{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <ManagerLayout title="분석 대시보드" activeTab="analytics">
        <div className="flex flex-col justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="분석 대시보드" activeTab="analytics">
      <div className="space-y-6">
        {/* 탭 메뉴 */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                  ? `bg-${tab.color}-600 text-white shadow-md`
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-gray-600 mt-1">
              {activeTab === 'quotes' && '견적 현황과 트렌드를 분석합니다.'}
              {activeTab === 'reservations' && '예약 현황과 고객 분석을 제공합니다.'}
              {activeTab === 'payments' && '결제 현황과 수익 분석을 확인합니다.'}
              {activeTab === 'confirmations' && '확인서 발송 현황을 분석합니다.'}
            </p>
          </div>

          <button
            onClick={loadAnalyticsData}
            disabled={loading}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* 탭별 컨텐츠 */}
        {activeTab === 'quotes' && renderQuotesAnalytics()}
        {activeTab === 'reservations' && renderReservationsAnalytics()}
        {activeTab === 'payments' && renderPaymentsAnalytics()}
        {activeTab === 'confirmations' && renderConfirmationsAnalytics()}
      </div>
    </ManagerLayout>
  );
}
