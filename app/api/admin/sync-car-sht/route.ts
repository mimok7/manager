import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// 서비스 롤 키를 사용하는 Supabase 클라이언트 (RLS 우회)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, existing_id, reservation_id, vehicle_number, seat_number, sht_category, usage_date, request_note } = body;

        // 필수 필드 검증
        if (!reservation_id) {
            return NextResponse.json(
                { error: 'reservation_id는 필수입니다.' },
                { status: 400 }
            );
        }

        let data = null;

        // action이 'replace'면 기존 데이터 삭제 후 재생성
        if (action === 'replace' && existing_id) {
            const { error: deleteError } = await supabaseAdmin
                .from('reservation_car_sht')
                .delete()
                .eq('id', existing_id);

            if (deleteError) {
                console.error('reservation_car_sht 삭제 오류:', deleteError);
                return NextResponse.json(
                    { error: `삭제 실패: ${deleteError.message}` },
                    { status: 500 }
                );
            }
        }

        // reservation_car_sht에 데이터 삽입 (서비스 롤로 RLS 우회)
        const { data: insertData, error } = await supabaseAdmin
            .from('reservation_car_sht')
            .insert({
                reservation_id,
                vehicle_number: vehicle_number || '',
                seat_number: seat_number || '',
                sht_category: sht_category || '',
                usage_date: usage_date || null,
                request_note: request_note || '',
            })
            .select()
            .single();

        if (error) {
            console.error('reservation_car_sht 삽입 오류:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        data = insertData;

        return NextResponse.json({ data, success: true });
    } catch (error: any) {
        console.error('API 오류:', error);
        return NextResponse.json(
            { error: error.message || '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}