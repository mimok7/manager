'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import UnifiedConfirmation, { UnifiedQuoteData } from '@/components/UnifiedConfirmation';
import SectionBox from '@/components/SectionBox';

function ManagerConfirmationViewClient() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.quote_id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unified, setUnified] = useState<UnifiedQuoteData | null>(null);

  useEffect(() => {
    if (!quoteId) {
      setError('견적 ID가 제공되지 않았습니다.');
      setLoading(false);
      return;
    }
    loadUnifiedData(quoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const enrichWithPrice = async (rows: any[], type: string) => {
    if (!rows?.length) return [] as any[];
    return Promise.all(rows.map(async (item) => {
      let price: any = null;
      try {
        if (type === 'cruise' && item.room_price_code) {
          const { data } = await supabase.from('room_price').select('*').eq('room_code', item.room_price_code).single();
          price = data;
        } else if (type === 'cruise_car' && item.car_price_code) {
          const { data } = await supabase.from('car_price').select('*').eq('car_code', item.car_price_code).single();
          price = data;
        } else if (type === 'airport' && item.airport_price_code) {
          const { data } = await supabase.from('airport_price').select('*').eq('airport_code', item.airport_price_code).single();
          price = data;
        } else if (type === 'hotel' && item.hotel_price_code) {
          const { data } = await supabase.from('hotel_price').select('*').eq('hotel_code', item.hotel_price_code).single();
          price = data;
        } else if (type === 'rentcar' && item.rentcar_price_code) {
          const { data } = await supabase.from('rent_price').select('*').eq('rent_code', item.rentcar_price_code).single();
          price = data;
        } else if (type === 'tour' && item.tour_price_code) {
          const { data } = await supabase.from('tour_price').select('*').eq('tour_code', item.tour_price_code).single();
          price = data;
        }
      } catch { }
      return { ...item, price_info: price };
    }));
  };

  const money = (n: any) => (typeof n === 'number' && !isNaN(n) ? n : Number(n) || 0);

  async function loadUnifiedData(id: string) {
    try {
      setLoading(true);
      // 1) 우선 quote 기준 시도
      const { data: quote } = await supabase
        .from('quote')
        .select('id, title, user_id, total_price')
        .eq('id', id)
        .single();

      if (quote) {
        const { data: user } = await supabase
          .from('users')
          .select('name, phone_number')
          .eq('id', quote.user_id)
          .single();

        const { data: reservationList } = await supabase
          .from('reservation')
          .select('re_id, re_type, re_status')
          .eq('re_quote_id', id);

        const resList = reservationList || [];
        const reIds = resList.map(r => r.re_id);

        const [
          cruiseRes, cruiseCarRes, apRes, htRes, rcRes, trRes, shtRes
        ] = await Promise.all([
          reIds.length ? supabase.from('reservation_cruise').select('*').in('reservation_id', reIds) : Promise.resolve({ data: [] }),
          reIds.length ? supabase.from('reservation_cruise_car').select('*').in('reservation_id', reIds) : Promise.resolve({ data: [] }),
          supabase.from('reservation_airport').select('*').in('reservation_id', reIds),
          supabase.from('reservation_hotel').select('*').in('reservation_id', reIds),
          supabase.from('reservation_rentcar').select('*').in('reservation_id', reIds),
          supabase.from('reservation_tour').select('*').in('reservation_id', reIds),
          supabase.from('reservation_car_sht').select('*').in('reservation_id', reIds)
        ] as any);

        const ec = await enrichWithPrice((cruiseRes as any).data, 'cruise');
        const ecc = await enrichWithPrice((cruiseCarRes as any).data, 'cruise_car');
        const eap = await enrichWithPrice((apRes as any).data, 'airport');
        const eht = await enrichWithPrice((htRes as any).data, 'hotel');
        const erc = await enrichWithPrice((rcRes as any).data, 'rentcar');
        const etr = await enrichWithPrice((trRes as any).data, 'tour');
        const sht = ((shtRes as any).data || []) as any[];

        const reStatus = new Map<string, string>(resList.map(r => [r.re_id, r.re_status]));
        const unifiedRows: UnifiedQuoteData['reservations'] = [];

        ec?.forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const unit = money(row?.price_info?.price); const qty = money(row?.guest_count) || 1;
          unifiedRows.push({ reservation_id: `${rid}_cruise_${i}`, service_type: 'cruise', service_details: row, amount: row?.room_total_price ? money(row.room_total_price) : unit * qty, status: (reStatus.get(rid) as string) || 'pending' });
        });
        ecc?.forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const unit = money(row?.price_info?.price); const qty = money(row?.car_count) || 1;
          unifiedRows.push({ reservation_id: `${rid}_cruise_car_${i}`, service_type: 'cruise_car', service_details: row, amount: row?.car_total_price ? money(row.car_total_price) : unit * qty, status: (reStatus.get(rid) as string) || 'pending' });
        });
        eap?.forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const unit = money(row?.price_info?.price); const qty = money(row?.ra_passenger_count) || 1;
          unifiedRows.push({ reservation_id: `${rid}_airport_${i}`, service_type: 'airport', service_details: row, amount: unit * qty, status: (reStatus.get(rid) as string) || 'pending' });
        });
        eht?.forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const unit = money(row?.price_info?.price); const nights = money(row?.nights) || (Number(String(row?.schedule || '').match(/\d+/)?.[0]) || 1); const rooms = money(row?.room_count) || 1;
          unifiedRows.push({ reservation_id: `${rid}_hotel_${i}`, service_type: 'hotel', service_details: row, amount: unit * nights * rooms, status: (reStatus.get(rid) as string) || 'pending' });
        });
        erc?.forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const unit = money(row?.price_info?.price); const qty = money(row?.rental_days) || 1;
          unifiedRows.push({ reservation_id: `${rid}_rentcar_${i}`, service_type: 'rentcar', service_details: row, amount: unit * qty, status: (reStatus.get(rid) as string) || 'pending' });
        });
        etr?.forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const unit = money(row?.price_info?.price); const qty = money(row?.participant_count) || money(row?.tour_capacity) || 1;
          unifiedRows.push({ reservation_id: `${rid}_tour_${i}`, service_type: 'tour', service_details: row, amount: unit * qty, status: (reStatus.get(rid) as string) || 'pending' });
        });
        (sht || []).forEach((row: any, i: number) => {
          const rid = row?.reservation_id; const amount = money(row?.total_price) || money(row?.unit_price) || 0;
          unifiedRows.push({ reservation_id: `${rid}_sht_${i}`, service_type: 'sht', service_details: row, amount, status: (reStatus.get(rid) as string) || 'pending' });
        });

        setUnified({
          id: quote.id,
          title: quote.title,
          user_name: user?.name || '',
          user_phone: user?.phone_number || '',
          total_price: money(quote.total_price) || unifiedRows.reduce((s, r) => s + money(r.amount), 0),
          reservations: unifiedRows,
        });
        setLoading(false);
        return;
      }

      // 2) quote가 없으면 예약 단건 기준
      const { data: reservation } = await supabase
        .from('reservation')
        .select('*')
        .eq('re_id', id)
        .single();
      if (!reservation) {
        setError('예약/견적 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }
      const { data: user } = await supabase
        .from('users')
        .select('name, phone_number')
        .eq('id', reservation.re_user_id)
        .single();

      let detail: any = null; let type = reservation.re_type as string;
      if (type === 'cruise') {
        const { data } = await supabase.from('reservation_cruise').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; detail = (await enrichWithPrice([detail], 'cruise'))[0];
      } else if (type === 'cruise_car') {
        const { data } = await supabase.from('reservation_cruise_car').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; detail = (await enrichWithPrice([detail], 'cruise_car'))[0];
      } else if (type === 'airport') {
        const { data } = await supabase.from('reservation_airport').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; detail = (await enrichWithPrice([detail], 'airport'))[0];
      } else if (type === 'hotel') {
        const { data } = await supabase.from('reservation_hotel').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; detail = (await enrichWithPrice([detail], 'hotel'))[0];
      } else if (type === 'rentcar') {
        const { data } = await supabase.from('reservation_rentcar').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; detail = (await enrichWithPrice([detail], 'rentcar'))[0];
      } else if (type === 'tour') {
        const { data } = await supabase.from('reservation_tour').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; detail = (await enrichWithPrice([detail], 'tour'))[0];
      } else if (type === 'car') {
        const { data } = await supabase.from('reservation_car_sht').select('*').eq('reservation_id', reservation.re_id).single();
        detail = data; type = 'sht';
      }

      const unit = money(detail?.price_info?.price);
      const amount = detail?.room_total_price ? money(detail.room_total_price)
        : detail?.car_total_price ? money(detail.car_total_price)
          : type === 'airport' ? unit * (money(detail?.ra_passenger_count) || 1)
            : type === 'hotel' ? unit * ((money(detail?.nights) || 1) * (money(detail?.room_count) || 1))
              : type === 'rentcar' ? unit * (money(detail?.rental_days) || 1)
                : type === 'tour' ? unit * (money(detail?.participant_count) || money(detail?.tour_capacity) || 1)
                  : money(detail?.total_price) || money(detail?.unit_price) || unit || 0;

      setUnified({
        id: reservation.re_id,
        title: detail?.title || '예약확인서',
        user_name: user?.name || '',
        user_phone: user?.phone_number || '',
        total_price: amount,
        reservations: [
          { reservation_id: reservation.re_id, service_type: type, service_details: detail, amount, status: reservation.re_status }
        ]
      });
      setLoading(false);
    } catch (e) {
      setError('예약 정보를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <ManagerLayout title="예약확인서 상세보기" activeTab="confirmation">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </ManagerLayout>
    );
  }
  if (error) {
    return (
      <ManagerLayout title="예약확인서 상세보기" activeTab="confirmation">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          <button onClick={() => router.back()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">돌아가기</button>
        </div>
      </ManagerLayout>
    );
  }
  if (!unified) return null;

  return (
    <ManagerLayout title="예약확인서 상세보기" activeTab="confirmation">
      <div className="p-4">
        <UnifiedConfirmation data={unified} />

        {/* 관리 작업 */}
        <div className="mt-6">
          <SectionBox title="🛠️ 관리 작업">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => router.push(`/manager/confirmation/${quoteId}/generate`)}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>📄</span>
                <span>확인서 생성</span>
              </button>
              <button
                onClick={() => window.open(`/customer/email-preview?quote_id=${quoteId}&token=manager`, '_blank')}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <span>📧</span>
                <span>이메일 미리보기</span>
              </button>
              <button
                onClick={() => window.open(`/customer/confirmation?quote_id=${quoteId}&token=manager`, '_blank')}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <span>👁️</span>
                <span>고객 확인서</span>
              </button>
              <button
                onClick={() => router.push('/manager/confirmation')}
                className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span>📋</span>
                <span>목록으로</span>
              </button>
            </div>
          </SectionBox>
        </div>
      </div>
    </ManagerLayout>
  );
}

export default ManagerConfirmationViewClient;