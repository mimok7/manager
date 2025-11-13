'use client';

import React from 'react';
import supabase from '@/lib/supabase';
import {
    Calendar,
    Clock,
    Ship,
    Plane,
    Building,
    MapPin,
    Car,
    User,
    Mail,
    CreditCard,
    FileText,
    X,
    ChevronLeft
} from 'lucide-react';

// 크루즈 상세 정보 컴포넌트
const CruiseDetailSection = ({ reservation }: { reservation: any }) => {
    const [cruiseDetails, setCruiseDetails] = React.useState<any[]>([]);
    const [carDetails, setCarDetails] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const fetchCruiseDetails = async () => {
            if (!reservation?.re_id || reservation?.re_type !== 'cruise') return;

            setLoading(true);
            try {
                // 크루즈 예약 정보 조회 (reservation_cruise 테이블)
                const { data: cruiseData, error: cruiseError } = await supabase
                    .from('reservation_cruise')
                    .select('*')
                    .eq('reservation_id', reservation.re_id);

                // 크루즈 차량 예약 정보 조회 (reservation_cruise_car 테이블)
                const { data: carData, error: carError } = await supabase
                    .from('reservation_cruise_car')
                    .select('*')
                    .eq('reservation_id', reservation.re_id);

                if (!cruiseError && cruiseData) {
                    // room_price 정보 조회하여 크루즈 데이터에 추가
                    const enrichedCruiseData = await Promise.all(
                        cruiseData.map(async (cruise) => {
                            if (cruise.room_price_code) {
                                const { data: roomPrice } = await supabase
                                    .from('room_price')
                                    .select('*')
                                    .eq('room_code', cruise.room_price_code)
                                    .single();
                                return { ...cruise, room_price: roomPrice };
                            }
                            return cruise;
                        })
                    );
                    setCruiseDetails(enrichedCruiseData);
                }

                if (!carError && carData) {
                    // car_price 정보 조회하여 차량 데이터에 추가
                    const enrichedCarData = await Promise.all(
                        carData.map(async (car) => {
                            if (car.car_price_code) {
                                const { data: carPrice } = await supabase
                                    .from('car_price')
                                    .select('*')
                                    .eq('car_code', car.car_price_code)
                                    .single();
                                return { ...car, car_price: carPrice };
                            }
                            return car;
                        })
                    );
                    setCarDetails(enrichedCarData);
                }
            } catch (error) {
                console.error('크루즈 상세 정보 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCruiseDetails();
    }, [reservation?.re_id]);

    if (reservation?.re_type !== 'cruise') return null;

    return (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                <Ship className="w-5 h-5 mr-2" />
                크루즈 상세 정보
            </h3>

            {loading ? (
                <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* 크루즈 객실 정보 */}
                    {cruiseDetails.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-blue-700 mb-3 flex items-center">
                                <Building className="w-4 h-4 mr-1" />
                                크루즈 객실 정보
                            </h4>
                            <div className="space-y-3">
                                {cruiseDetails.map((cruise, index) => (
                                    <div key={index} className="bg-white p-4 rounded border border-blue-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <div><strong>룸 가격 코드:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{cruise.room_price_code}</span></div>
                                            <div><strong>룸 스케줄:</strong> {cruise.room_price?.schedule || '정보 없음'}</div>
                                            <div><strong>룸 카테고리:</strong> {cruise.room_price?.room_category || '정보 없음'}</div>
                                            <div><strong>크루즈:</strong> {cruise.room_price?.cruise || '정보 없음'}</div>
                                            <div><strong>룸 타입:</strong> {cruise.room_price?.room_type || '정보 없음'}</div>
                                            <div><strong>단가:</strong> <span className="text-green-600 font-medium">{cruise.room_price?.price?.toLocaleString() || 0}동</span></div>
                                            {cruise.room_price?.payment && <div><strong>결제:</strong> <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">{cruise.room_price.payment}</span></div>}
                                            <div>
                                                <strong>투숙객 수:</strong>
                                                <span className="font-semibold text-purple-600 text-lg ml-1">
                                                    {cruise.guest_count !== null && cruise.guest_count !== undefined ? `${cruise.guest_count}명` : '정보 없음'}
                                                </span>
                                            </div>
                                            <div><strong>체크인:</strong> {cruise.checkin ? new Date(cruise.checkin).toLocaleDateString('ko-KR') : '미정'}</div>
                                            <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{cruise.room_total_price?.toLocaleString() || 0}동</span></div>
                                            {cruise.boarding_code && <div><strong>탑승 코드:</strong> {cruise.boarding_code}</div>}
                                            {cruise.boarding_assist && <div><strong>탑승 지원:</strong> 예</div>}
                                        </div>
                                        {cruise.request_note && (
                                            <div className="mt-3 pt-3 border-t border-blue-100">
                                                <strong>요청사항:</strong>
                                                <div className="bg-gray-50 p-2 rounded mt-1 text-sm">{cruise.request_note}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 크루즈 차량 정보 */}
                    {carDetails.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-blue-700 mb-3 flex items-center">
                                <Car className="w-4 h-4 mr-1" />
                                크루즈 차량 정보
                            </h4>
                            <div className="space-y-3">
                                {carDetails.map((car, index) => (
                                    <div key={index} className="bg-white p-4 rounded border border-blue-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <div><strong>차량 가격 코드:</strong> <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">{car.car_price_code}</span></div>
                                            <div><strong>차량 카테고리:</strong> {car.car_price?.car_category || '정보 없음'}</div>
                                            <div><strong>크루즈:</strong> {car.car_price?.cruise || '정보 없음'}</div>
                                            <div><strong>차량 타입:</strong> {car.car_price?.car_type || '정보 없음'}</div>
                                            <div><strong>가격:</strong> <span className="text-green-600 font-medium">{car.car_price?.price?.toLocaleString() || 0}동</span></div>
                                            <div><strong>스케줄:</strong> {car.car_price?.schedule || '정보 없음'}</div>
                                            <div><strong>차량 수:</strong> {car.car_count}대</div>
                                            <div><strong>승객 수:</strong> {car.passenger_count}명</div>
                                            <div><strong>픽업 일시:</strong> {car.pickup_datetime ? new Date(car.pickup_datetime).toLocaleDateString('ko-KR') : '미정'}</div>
                                            <div><strong>픽업 장소:</strong> {car.pickup_location || '미정'}</div>
                                            <div><strong>도착 장소:</strong> {car.dropoff_location || '미정'}</div>
                                            <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{car.car_total_price?.toLocaleString() || 0}동</span></div>
                                        </div>
                                        {car.request_note && (
                                            <div className="mt-3 pt-3 border-t border-green-100">
                                                <strong>요청사항:</strong>
                                                <div className="bg-gray-50 p-2 rounded mt-1 text-sm">{car.request_note}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 상세 정보가 없는 경우 */}
                    {cruiseDetails.length === 0 && carDetails.length === 0 && !loading && (
                        <div className="text-center py-6 text-gray-600">
                            <p>크루즈 상세 정보를 찾을 수 없습니다.</p>
                            <p className="text-sm mt-1">예약 ID: {reservation.re_id}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 다른 서비스 상세 정보 컴포넌트
const ServiceDetailSection = ({ reservation }: { reservation: any }) => {
    const [serviceDetails, setServiceDetails] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const fetchServiceDetails = async () => {
            if (!reservation?.re_id || !reservation?.re_type) return;

            const serviceType = reservation.re_type;
            if (serviceType === 'cruise') return; // 크루즈는 별도 컴포넌트에서 처리

            setLoading(true);
            try {
                let tableName = '';

                switch (serviceType) {
                    case 'airport':
                        tableName = 'reservation_airport';
                        break;
                    case 'hotel':
                        tableName = 'reservation_hotel';
                        break;
                    case 'tour':
                        tableName = 'reservation_tour';
                        break;
                    case 'rentcar':
                        tableName = 'reservation_rentcar';
                        break;
                    default:
                        return;
                }

                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('reservation_id', reservation.re_id);

                if (!error && data) {
                    // 각 서비스별로 가격 정보를 별도 조회하여 추가
                    const enrichedData = await Promise.all(
                        data.map(async (item) => {
                            let priceData = null;
                            switch (serviceType) {
                                case 'airport':
                                    if (item.airport_price_code) {
                                        const { data: priceInfo } = await supabase
                                            .from('airport_price')
                                            .select('*')
                                            .eq('airport_code', item.airport_price_code)
                                            .single();
                                        priceData = priceInfo;
                                    }
                                    break;
                                case 'hotel':
                                    if (item.hotel_price_code) {
                                        const { data: priceInfo } = await supabase
                                            .from('hotel_price')
                                            .select('*')
                                            .eq('hotel_code', item.hotel_price_code)
                                            .single();
                                        priceData = priceInfo;
                                    }
                                    break;
                                case 'tour':
                                    if (item.tour_price_code) {
                                        const { data: priceInfo } = await supabase
                                            .from('tour_price')
                                            .select('*')
                                            .eq('tour_code', item.tour_price_code)
                                            .single();
                                        priceData = priceInfo;
                                    }
                                    break;
                                case 'rentcar':
                                    if (item.rentcar_price_code) {
                                        const { data: priceInfo } = await supabase
                                            .from('rent_price')
                                            .select('*')
                                            .eq('rent_code', item.rentcar_price_code)
                                            .single();
                                        priceData = priceInfo;
                                    }
                                    break;
                            }
                            return { ...item, price_info: priceData };
                        })
                    );
                    setServiceDetails(enrichedData);
                }
            } catch (error) {
                console.error('서비스 상세 정보 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchServiceDetails();
    }, [reservation?.re_id, reservation?.re_type]);

    if (!reservation?.re_type || reservation?.re_type === 'cruise') {
        return null;
    }

    const serviceType = reservation.re_type;
    const getServiceIcon = () => {
        switch (serviceType) {
            case 'airport': return <Plane className="w-4 h-4 mr-1" />;
            case 'hotel': return <Building className="w-4 h-4 mr-1" />;
            case 'tour': return <MapPin className="w-4 h-4 mr-1" />;
            case 'rentcar': return <Car className="w-4 h-4 mr-1" />;
            default: return <FileText className="w-4 h-4 mr-1" />;
        }
    };

    const getServiceName = (type: string) => {
        const names: Record<string, string> = {
            airport: '공항 서비스',
            hotel: '호텔',
            tour: '투어',
            rentcar: '렌터카'
        };
        return names[type] || type;
    };

    return (
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                {getServiceIcon()}
                {getServiceName(serviceType)} 상세 정보
            </h3>

            {loading ? (
                <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {serviceDetails.length > 0 ? (
                        serviceDetails.map((detail, index) => (
                            <div key={index} className="bg-white p-4 rounded border border-green-100">
                                {serviceType === 'airport' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div><strong>공항 가격 코드:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{detail.airport_price_code}</span></div>
                                        <div><strong>공항 카테고리:</strong> {detail.price_info?.airport_category || '정보 없음'}</div>
                                        <div><strong>공항 경로:</strong> {detail.price_info?.airport_route || '정보 없음'}</div>
                                        <div><strong>차량 타입:</strong> {detail.price_info?.airport_car_type || '정보 없음'}</div>
                                        <div><strong>가격:</strong> <span className="text-green-600 font-medium">{detail.price_info?.price?.toLocaleString() || 0}동</span></div>
                                        <div><strong>공항 위치:</strong> {detail.ra_airport_location || '미정'}</div>
                                        <div><strong>항공편 번호:</strong> {detail.ra_flight_number || '미정'}</div>
                                        <div><strong>일시:</strong> {detail.ra_datetime ? new Date(detail.ra_datetime).toLocaleString('ko-KR') : '미정'}</div>
                                        <div><strong>경유지:</strong> {detail.ra_stopover_location || '없음'}</div>
                                        <div><strong>대기시간:</strong> {detail.ra_stopover_wait_minutes ? `${detail.ra_stopover_wait_minutes}분` : '없음'}</div>
                                        <div><strong>차량 수:</strong> {detail.ra_car_count || 0}대</div>
                                        <div><strong>승객 수:</strong> {detail.ra_passenger_count || 0}명</div>
                                        <div><strong>짐 개수:</strong> {detail.ra_luggage_count || 0}개</div>
                                        <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{detail.total_price?.toLocaleString() || 0}동</span></div>
                                        {detail.request_note && (
                                            <div className="md:col-span-2 mt-3 pt-3 border-t border-blue-100">
                                                <strong>요청사항:</strong>
                                                <div className="bg-gray-50 p-2 rounded mt-1 text-sm">{detail.request_note}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {serviceType === 'hotel' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div><strong>호텔 가격 코드:</strong> <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">{detail.hotel_price_code}</span></div>
                                        <div><strong>호텔명:</strong> {detail.price_info?.hotel_name || '정보 없음'}</div>
                                        <div><strong>룸명:</strong> {detail.price_info?.room_name || '정보 없음'}</div>
                                        <div><strong>룸 타입:</strong> {detail.price_info?.room_type || '정보 없음'}</div>
                                        <div><strong>가격:</strong> <span className="text-green-600 font-medium">{detail.price_info?.price?.toLocaleString() || 0}동</span></div>
                                        <div><strong>스케줄:</strong> {detail.schedule || '정보 없음'}</div>
                                        <div><strong>객실 수:</strong> {detail.room_count || 0}개</div>
                                        <div>
                                            <strong>투숙객 수:</strong>
                                            <span className="font-semibold text-purple-600 text-lg ml-1">
                                                {detail.guest_count !== null && detail.guest_count !== undefined ? `${detail.guest_count}명` : '0명'}
                                            </span>
                                        </div>
                                        <div><strong>체크인:</strong> {detail.checkin_date ? new Date(detail.checkin_date).toLocaleDateString('ko-KR') : '미정'}</div>
                                        <div><strong>조식 서비스:</strong> {detail.breakfast_service || '없음'}</div>
                                        <div><strong>호텔 카테고리:</strong> {detail.hotel_category || '정보 없음'}</div>
                                        <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{detail.total_price?.toLocaleString() || 0}동</span></div>
                                        {detail.request_note && (
                                            <div className="md:col-span-2 mt-3 pt-3 border-t border-purple-100">
                                                <strong>요청사항:</strong>
                                                <div className="bg-gray-50 p-2 rounded mt-1 text-sm">{detail.request_note}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {serviceType === 'tour' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div><strong>투어 가격 코드:</strong> <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">{detail.tour_price_code}</span></div>
                                        <div><strong>투어명:</strong> {detail.price_info?.tour_name || '정보 없음'}</div>
                                        <div><strong>투어 타입:</strong> {detail.price_info?.tour_type || '정보 없음'}</div>
                                        <div><strong>투어 차량:</strong> {detail.price_info?.tour_vehicle || '정보 없음'}</div>
                                        <div><strong>가격:</strong> <span className="text-green-600 font-medium">{detail.price_info?.price?.toLocaleString() || 0}동</span></div>
                                        <div><strong>투어 정원:</strong> {detail.price_info?.tour_capacity || 0}명</div>
                                        <div><strong>투어 인원:</strong> {detail.tour_capacity || 0}명</div>
                                        <div><strong>사용 날짜:</strong> {detail.usage_date ? new Date(detail.usage_date).toLocaleDateString('ko-KR') : '미정'}</div>
                                        <div><strong>픽업 위치:</strong> {detail.pickup_location || '미정'}</div>
                                        <div><strong>드롭오프 위치:</strong> {detail.dropoff_location || '미정'}</div>
                                        <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{detail.total_price?.toLocaleString() || 0}동</span></div>
                                        {detail.request_note && (
                                            <div className="md:col-span-2 mt-3 pt-3 border-t border-orange-100">
                                                <strong>요청사항:</strong>
                                                <div className="bg-gray-50 p-2 rounded mt-1 text-sm">{detail.request_note}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {serviceType === 'rentcar' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div><strong>렌터카 가격 코드:</strong> <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">{detail.rentcar_price_code}</span></div>
                                        <div><strong>렌터카 타입:</strong> {detail.price_info?.rent_type || '정보 없음'}</div>
                                        <div><strong>렌터카 카테고리:</strong> {detail.price_info?.rent_category || '정보 없음'}</div>
                                        <div><strong>렌터카 경로:</strong> {detail.price_info?.rent_route || '정보 없음'}</div>
                                        <div><strong>차량 타입:</strong> {detail.price_info?.rent_car_type || '정보 없음'}</div>
                                        <div><strong>가격:</strong> <span className="text-green-600 font-medium">{detail.price_info?.price?.toLocaleString() || 0}동</span></div>
                                        <div><strong>렌터카 수:</strong> {detail.rentcar_count || 0}대</div>
                                        <div><strong>차량 수:</strong> {detail.car_count || 0}대</div>
                                        <div><strong>승객 수:</strong> {detail.passenger_count || 0}명</div>
                                        <div><strong>픽업 일시:</strong> {detail.pickup_datetime ? new Date(detail.pickup_datetime).toLocaleString('ko-KR') : '미정'}</div>
                                        <div><strong>픽업 위치:</strong> {detail.pickup_location || '미정'}</div>
                                        <div><strong>목적지:</strong> {detail.destination || '미정'}</div>
                                        <div><strong>경유지:</strong> {detail.via_location || '없음'}</div>
                                        <div><strong>경유 대기:</strong> {detail.via_waiting || '없음'}</div>
                                        <div><strong>짐 개수:</strong> {detail.luggage_count || 0}개</div>
                                        <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{detail.total_price?.toLocaleString() || 0}동</span></div>
                                        {detail.request_note && (
                                            <div className="md:col-span-2 mt-3 pt-3 border-t border-red-100">
                                                <strong>요청사항:</strong>
                                                <div className="bg-gray-50 p-2 rounded mt-1 text-sm">{detail.request_note}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 text-gray-600">
                            <p>{getServiceName(serviceType)} 상세 정보를 찾을 수 없습니다.</p>
                            <p className="text-sm mt-1">예약 ID: {reservation.re_id}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface ReservationDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    reservation: any;
    title?: string;
    onRefresh?: () => void; // 목록 새로고침 콜백 추가
    onBack?: () => void; // 뒤로가기 콜백 추가
    selectedUser?: any; // 선택된 사용자 정보 추가
}

export default function ReservationDetailModal({
    isOpen,
    onClose,
    reservation,
    title = "예약 상세 정보",
    onRefresh,
    onBack,
    selectedUser
}: ReservationDetailModalProps) {
    if (!isOpen || !reservation) return null;

    /* ----------------------- 상태 관리 ----------------------- */
    const [confirming, setConfirming] = React.useState(false);
    const [currentStatus, setCurrentStatus] = React.useState(reservation.re_status || reservation.reservation?.re_status);
    const [allUserReservations, setAllUserReservations] = React.useState<any[]>([]);
    const [loadingAllReservations, setLoadingAllReservations] = React.useState(false);

    /* ----------------------- 사용자 정보 조회 (users 테이블) ----------------------- */
    const [userInfo, setUserInfo] = React.useState<any | null>(null);

    // 여러 소스 중 re_user_id 우선 사용
    const userId =
        reservation?.re_user_id ??
        reservation?.reservation?.re_user_id ??
        reservation?.user_id ??
        null;

    React.useEffect(() => {
        let cancelled = false;
        async function fetchUser() {
            if (!userId) {
                setUserInfo(null);
                return;
            }
            const { data, error } = await supabase
                .from('users')
                .select('id, name, english_name, nickname, email')
                .eq('id', userId)
                .maybeSingle();

            if (!cancelled) {
                if (error) {
                    console.warn('users 조회 실패:', error);
                    setUserInfo(null);
                } else {
                    setUserInfo(data ?? null);
                }
            }
        }
        fetchUser();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    /* ----------------------- 해당 사용자의 모든 예약 서비스 조회 ----------------------- */
    React.useEffect(() => {
        let cancelled = false;
        async function fetchAllUserReservations() {
            if (!userId) {
                setAllUserReservations([]);
                return;
            }

            setLoadingAllReservations(true);
            try {
                // 1. 해당 사용자의 모든 예약 조회
                const { data: reservations, error: reservationsError } = await supabase
                    .from('reservation')
                    .select('re_id, re_type, re_status, re_created_at, re_quote_id')
                    .eq('re_user_id', userId)
                    .order('re_created_at', { ascending: false });

                if (reservationsError || !reservations || cancelled) {
                    setAllUserReservations([]);
                    setLoadingAllReservations(false);
                    return;
                }

                // 2. 각 예약의 서비스 상세 정보 조회
                const allServices = [];
                for (const res of reservations) {
                    let serviceData = null;

                    switch (res.re_type) {
                        case 'cruise': {
                            const { data } = await supabase
                                .from('reservation_cruise')
                                .select('*, room_price:room_price_code(cruise, room_type, room_category, route, base_price)')
                                .eq('reservation_id', res.re_id)
                                .maybeSingle();
                            serviceData = data;
                            console.log('크루즈 데이터:', serviceData);
                            break;
                        }
                        case 'airport': {
                            const { data } = await supabase
                                .from('reservation_airport')
                                .select('*, airport_price:airport_price_code(airport_category, airport_route, airport_car_type)')
                                .eq('reservation_id', res.re_id)
                                .maybeSingle();
                            serviceData = data;
                            console.log('공항 데이터:', serviceData);
                            break;
                        }
                        case 'hotel': {
                            const { data } = await supabase
                                .from('reservation_hotel')
                                .select('*, hotel_price:hotel_price_code(hotel_name, room_type, location, category)')
                                .eq('reservation_id', res.re_id)
                                .maybeSingle();
                            serviceData = data;
                            console.log('호텔 데이터:', serviceData);
                            break;
                        }
                        case 'tour': {
                            const { data } = await supabase
                                .from('reservation_tour')
                                .select('*, tour_price:tour_price_code(tour_name, category, location)')
                                .eq('reservation_id', res.re_id)
                                .maybeSingle();
                            serviceData = data;
                            console.log('투어 데이터:', serviceData);
                            break;
                        }
                        case 'rentcar': {
                            const { data } = await supabase
                                .from('reservation_rentcar')
                                .select('*, rentcar_price:rentcar_price_code(vehicle_type, category, passenger_capacity)')
                                .eq('reservation_id', res.re_id)
                                .maybeSingle();
                            serviceData = data;
                            console.log('렌터카 데이터:', serviceData);
                            break;
                        }
                        case 'car': {
                            // 크루즈 차량 먼저 확인
                            const { data: cruiseCar } = await supabase
                                .from('reservation_cruise_car')
                                .select('*, car_price:car_price_code(car_category, cruise, car_type, passenger_count)')
                                .eq('reservation_id', res.re_id)
                                .maybeSingle();
                            if (cruiseCar) {
                                serviceData = cruiseCar;
                                console.log('크루즈 차량 데이터:', serviceData);
                            } else {
                                // 스하차량 확인
                                const { data: shtCar } = await supabase
                                    .from('reservation_car_sht')
                                    .select('*')
                                    .eq('reservation_id', res.re_id)
                                    .maybeSingle();
                                serviceData = shtCar;
                                console.log('SHT 차량 데이터:', serviceData);
                            }
                            break;
                        }
                    }

                    // 데이터가 없어도 예약은 추가 (서비스 세부 정보가 없을 수 있음)
                    allServices.push({
                        ...res,
                        serviceDetails: serviceData
                    });
                }

                if (!cancelled) {
                    setAllUserReservations(allServices);
                }
            } catch (error) {
                console.error('사용자 예약 조회 실패:', error);
                if (!cancelled) {
                    setAllUserReservations([]);
                }
            } finally {
                if (!cancelled) {
                    setLoadingAllReservations(false);
                }
            }
        }

        fetchAllUserReservations();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const safeText = (v: any, fb = '정보 없음') =>
        v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : fb;

    /* --------------------------- 예약 확정 처리 --------------------------- */
    const handleConfirmReservation = async () => {
        if (confirming) return;

        const reservationId = reservation.re_id || reservation.reservation?.re_id;
        if (!reservationId) {
            alert('예약 ID를 찾을 수 없습니다.');
            return;
        }

        if (!confirm('이 예약을 확정 처리하시겠습니까?')) {
            return;
        }

        setConfirming(true);
        try {
            const { data, error } = await supabase
                .from('reservation')
                .update({ re_status: 'confirmed' })
                .eq('re_id', reservationId)
                .select()
                .single();

            if (error) {
                console.error('예약 확정 실패:', error);
                alert('예약 확정에 실패했습니다. 다시 시도해주세요.');
            } else {
                alert('예약이 성공적으로 확정되었습니다.');
                setCurrentStatus('confirmed');
                // 부모 컴포넌트에 새로고침 요청 (페이지 새로고침 대신)
                if (onRefresh) {
                    onRefresh();
                }
            }
        } catch (error) {
            console.error('예약 확정 중 오류:', error);
            alert('예약 확정 중 오류가 발생했습니다.');
        } finally {
            setConfirming(false);
        }
    };

    /* --------------------------- 가격 테이블 정보 로드 --------------------------- */
    const loadPriceDetails = async (serviceType: string, priceCode: string) => {
        if (!priceCode) return null;

        try {
            let tableName = '';
            switch (serviceType) {
                case 'cruise':
                    tableName = 'room_price';
                    break;
                case 'cruise_car':
                case 'sht_car':
                case 'car':
                    tableName = 'car_price';
                    break;
                case 'airport':
                    tableName = 'airport_price';
                    break;
                case 'hotel':
                    tableName = 'hotel_price';
                    break;
                case 'tour':
                    tableName = 'tour_price';
                    break;
                case 'rentcar':
                    tableName = 'rentcar_price';
                    break;
                default:
                    return null;
            }

            const codeColumn =
                serviceType === 'cruise' ? 'room_code'
                    : serviceType === 'airport' ? 'airport_code'
                        : serviceType === 'hotel' ? 'hotel_code'
                            : serviceType === 'tour' ? 'tour_code'
                                : serviceType === 'rentcar' ? 'rentcar_code'
                                    : 'car_code';

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq(codeColumn, priceCode)
                .maybeSingle();

            if (error) {
                console.error(`${tableName} 조회 실패:`, error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('가격 정보 로드 실패:', error);
            return null;
        }
    };

    // 서비스명 반환
    const getServiceName = (type: string) => {
        switch (type) {
            case 'cruise': return '크루즈';
            case 'cruise_car': return '크루즈 차량';
            case 'sht_car': return '스하차량';
            case 'airport': return '공항';
            case 'hotel': return '호텔';
            case 'tour': return '투어';
            case 'rentcar': return '렌터카';
            case 'car': return '차량';
            default: return type;
        }
    };

    // 가격 테이블 정보를 표시하는 별도 컴포넌트
    const PriceTableInfo = ({ serviceType, priceCode }: { serviceType: string; priceCode: string }) => {
        const [priceInfo, setPriceInfo] = React.useState<any>(null);
        const [loading, setLoading] = React.useState(false);

        React.useEffect(() => {
            let cancelled = false;
            const run = async () => {
                if (!priceCode) {
                    setPriceInfo(null);
                    return;
                }
                setLoading(true);
                const data = await loadPriceDetails(serviceType, priceCode);
                if (!cancelled) {
                    setPriceInfo(data);
                    setLoading(false);
                }
            };
            run();
            return () => { cancelled = true; };
        }, [serviceType, priceCode]);

        // 컬럼명 한글화 매핑
        const getKoreanFieldName = (key: string, serviceType: string): string => {
            const commonFieldMap: Record<string, string> = {
                'id': 'ID',
                'created_at': '생성일',
                'updated_at': '수정일',
                'price': '가격',
                'base_price': '기본가격',
                'start_date': '시작날짜',
                'end_date': '종료날짜',
                'schedule': '일정',
                'payment': '결제',
                'conditions': '조건',
                'category': '카테고리',
                'route': '노선',
                'description': '설명',
                'vehicle_type': '차량타입',
                'car_type': '차량종류',
                'hotel_name': '호텔명',
                'room_type': '객실타입',
                'tour_name': '투어명',
                'rentcar_type': '렌터카종류'
            };

            const serviceFieldMaps: Record<string, Record<string, string>> = {
                'cruise': {
                    'room_code': '객실코드',
                    'room_category': '객실등급',
                    'cruise': '크루즈명',
                    'room_type': '객실타입',
                    'room_info': '객실정보'
                },
                'cruise_car': {
                    'car_code': '차량코드',
                    'car_category': '차량등급',
                    'car_type': '차량타입',
                    'seat_capacity': '좌석수'
                },
                'sht_car': {
                    'car_code': '차량코드',
                    'sht_category': '차량분류',
                    'car_type': '차량타입'
                },
                'airport': {
                    'airport_code': '공항코드',
                    'airport_location': '공항위치',
                    'service_type': '서비스타입',
                    'pickup_location': '픽업위치',
                    'destination': '목적지'
                },
                'hotel': {
                    'hotel_code': '호텔코드',
                    'hotel_category': '호텔등급',
                    'room_category': '객실등급',
                    'breakfast_included': '조식포함'
                },
                'tour': {
                    'tour_code': '투어코드',
                    'tour_category': '투어분류',
                    'duration': '소요시간',
                    'capacity': '수용인원'
                },
                'rentcar': {
                    'rentcar_code': '렌터카코드',
                    'car_model': '차량모델',
                    'fuel_type': '연료타입',
                    'transmission': '변속기'
                },
                'car': {
                    'car_code': '차량코드',
                    'car_model': '차량모델',
                    'color': '색상'
                }
            };

            const serviceMap = serviceFieldMaps[serviceType] || {};
            return serviceMap[key] || commonFieldMap[key] || key;
        };

        const renderEntries = () => {
            if (loading) {
                return (
                    <div className="flex items-center justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        <span className="ml-2 text-sm text-gray-500">가격 정보 로딩 중...</span>
                    </div>
                );
            }

            if (priceInfo) {
                return (
                    <div className="space-y-3">
                        {Object.entries(priceInfo).map(([key, value]) => {
                            if (key === 'id' || key === 'created_at' || key === 'updated_at') return null;

                            const koreanLabel = getKoreanFieldName(key, serviceType);
                            let displayValue: string;

                            if (typeof value === 'number' && key.includes('price')) {
                                displayValue = `${value.toLocaleString()}동`;
                            } else if (key.includes('date')) {
                                displayValue = value ? new Date(String(value)).toLocaleDateString('ko-KR') : '미정';
                            } else {
                                displayValue = String(value || '정보 없음');
                            }

                            return (
                                <div key={key} className="flex justify-between items-start">
                                    <span className="text-gray-700 font-medium min-w-0 flex-shrink-0 mr-3">
                                        {koreanLabel}:
                                    </span>
                                    <span className="text-gray-900 font-semibold text-right break-words">
                                        {displayValue}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                );
            }

            const getFallbackFields = (serviceType: string, priceCode: string): Record<string, any> => {
                switch (serviceType) {
                    case 'cruise':
                        return { room_code: priceCode || '', schedule: '미정', room_category: '미정', cruise: '미정', room_type: '미정', price: '미정' };
                    case 'airport':
                        return { airport_code: priceCode || '', category: '미정', route: '미정', price: '미정' };
                    case 'hotel':
                        return { hotel_code: priceCode || '', hotel_name: '미정', room_type: '미정', price: '미정' };
                    case 'tour':
                        return { tour_code: priceCode || '', tour_name: '미정', duration: '미정', price: '미정' };
                    case 'rentcar':
                        return { rentcar_code: priceCode || '', car_model: '미정', price: '미정' };
                    default:
                        return { code: priceCode || '', price: '미정' };
                }
            };

            const fallbackFields = getFallbackFields(serviceType, priceCode);

            return (
                <div className="space-y-3">
                    {Object.entries(fallbackFields).map(([key, value]) => {
                        const koreanLabel = getKoreanFieldName(key, serviceType);
                        return (
                            <div key={key} className="flex justify-between items-start">
                                <span className="text-gray-700 font-medium min-w-0 flex-shrink-0 mr-3">
                                    {koreanLabel}:
                                </span>
                                <span className="text-gray-900 font-semibold text-right">
                                    {String(value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            );
        };

        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-semibold text-blue-800 mb-3 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    💰 가격 테이블 정보
                </h5>
                {renderEntries()}
            </div>
        );
    };

    // 상세 데이터가 없을 때도 항상 표시되는 Fallback 상세 컴포넌트
    const FallbackServiceDetails = ({ reservation }: { reservation: any }) => {
        const [loading, setLoading] = React.useState(false);
        const [serviceData, setServiceData] = React.useState<any | null>(null);
        const [priceData, setPriceData] = React.useState<any | null>(null);
        const [error, setError] = React.useState<string | null>(null);

        React.useEffect(() => {
            const run = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    setServiceData(null);
                    setPriceData(null);

                    const type = reservation?.re_type || reservation?.reservation?.re_type;
                    const reId = reservation?.re_id || reservation?.reservation?.re_id;

                    const tableMap: Record<string, string> = {
                        cruise: 'reservation_cruise',
                        cruise_car: 'reservation_cruise_car',
                        sht_car: 'reservation_sht_car',
                        airport: 'reservation_airport',
                        hotel: 'reservation_hotel',
                        tour: 'reservation_tour',
                        rentcar: 'reservation_rentcar',
                        car: 'reservation_car_sht',
                    };

                    const table = tableMap[type];
                    if (!table || !reId) {
                        setError('유효한 서비스 타입 또는 예약 ID가 없습니다.');
                        return;
                    }

                    // 서비스 데이터 조회
                    let { data } = await supabase
                        .from(table)
                        .select('*')
                        .eq('reservation_id', reId)
                        .maybeSingle();

                    if (!data) {
                        const r2 = await supabase
                            .from(table)
                            .select('*')
                            .eq(type === 'airport' ? 'ra_reservation_id' : 're_id', reId)
                            .maybeSingle();
                        data = r2.data as any;
                    }

                    if (data) {
                        setServiceData(data);

                        // 가격 정보 조회
                        const priceTableMap: Record<string, string> = {
                            cruise: 'room_price',
                            cruise_car: 'car_price',
                            sht_car: 'car_price',
                            airport: 'airport_price',
                            hotel: 'hotel_price',
                            tour: 'tour_price',
                            rentcar: 'rent_price',
                            car: 'car_price',
                        };

                        const priceCodeMap: Record<string, string> = {
                            cruise: 'room_price_code',
                            cruise_car: 'car_price_code',
                            sht_car: 'car_price_code',
                            airport: 'airport_price_code',
                            hotel: 'hotel_price_code',
                            tour: 'tour_price_code',
                            rentcar: 'rentcar_price_code',
                            car: 'car_price_code',
                        };

                        const priceTable = priceTableMap[type];
                        const priceCodeField = priceCodeMap[type];
                        const priceCode = data[priceCodeField];

                        if (priceTable && priceCode) {
                            const priceKeyMap: Record<string, string> = {
                                room_price: 'room_code',
                                car_price: 'car_code',
                                airport_price: 'airport_code',
                                hotel_price: 'hotel_code',
                                tour_price: 'tour_code',
                                rent_price: 'rent_code',
                            };

                            const priceKey = priceKeyMap[priceTable];
                            if (priceKey) {
                                const { data: priceInfo } = await supabase
                                    .from(priceTable)
                                    .select('*')
                                    .eq(priceKey, priceCode)
                                    .maybeSingle();

                                if (priceInfo) {
                                    setPriceData(priceInfo);
                                }
                            }
                        }
                    }

                } catch (e: any) {
                    setError(e?.message || '알 수 없는 오류');
                } finally {
                    setLoading(false);
                }
            };
            run();
        }, [reservation?.re_id, reservation?.re_type, reservation?.reservation?.re_id, reservation?.reservation?.re_type]);

        // 서비스별 상세 정보 렌더링
        const renderServiceDetailsByType = (type: string, data: any, priceInfo: any) => {
            switch (type) {
                case 'cruise':
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-blue-600 border-b pb-2 flex items-center">
                                    <Ship className="w-4 h-4 mr-2" />
                                    🚢 크루즈 객실 정보
                                </h5>
                                <div><strong>객실 가격 코드:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{data.room_price_code}</span></div>
                                <div><strong>체크인 날짜:</strong> {data.checkin ? new Date(data.checkin).toLocaleDateString('ko-KR') : '미정'}</div>
                                <div>
                                    <strong>투숙객 수:</strong>
                                    <span className="font-semibold text-purple-600 text-lg ml-2">
                                        {data.guest_count !== null && data.guest_count !== undefined ? `${data.guest_count}명` : '정보 없음'}
                                    </span>
                                </div>
                                <div><strong>단가:</strong> <span className="text-lg text-orange-600">{data.unit_price?.toLocaleString()}동</span></div>
                                <div><strong>객실 총 금액:</strong> <span className="text-lg font-bold text-green-600">{data.room_total_price?.toLocaleString()}동</span></div>
                                <div><strong>탑승 지원:</strong> {data.boarding_assist ? '예' : '아니오'}</div>
                                <div><strong>생성일:</strong> {data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                                {data.request_note && (
                                    <div className="mt-4">
                                        <strong>요청사항:</strong>
                                        <div className="bg-gray-100 p-3 rounded mt-2 text-sm">{data.request_note}</div>
                                    </div>
                                )}
                            </div>
                            {priceInfo && (
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        💰 가격 정보
                                    </h5>
                                    <div><strong>객실명:</strong> {priceInfo.room_name || priceInfo.room_type}</div>
                                    <div><strong>객실 타입:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{priceInfo.room_type}</span></div>
                                    <div><strong>가격:</strong> <span className="text-lg text-green-600">{priceInfo.price?.toLocaleString()}동</span></div>
                                    {priceInfo.payment && <div><strong>결제:</strong> <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">{priceInfo.payment}</span></div>}
                                    {priceInfo.room_category && <div><strong>카테고리:</strong> {priceInfo.room_category}</div>}
                                    {priceInfo.capacity && <div><strong>수용 인원:</strong> {priceInfo.capacity}명</div>}
                                    {priceInfo.description && <div><strong>설명:</strong> {priceInfo.description}</div>}
                                </div>
                            )}
                        </div>
                    );

                case 'cruise_car':
                case 'sht_car':
                case 'car':
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-amber-600 border-b pb-2 flex items-center">
                                    <Car className="w-4 h-4 mr-2" />
                                    🚐 차량 정보
                                </h5>
                                {data.car_price_code && <div><strong>차량 가격 코드:</strong> <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-sm">{data.car_price_code}</span></div>}
                                {data.vehicle_number && <div><strong>차량번호:</strong> {data.vehicle_number}</div>}
                                {data.seat_number && <div><strong>좌석 수:</strong> {data.seat_number}석</div>}
                                {data.color_label && <div><strong>색상:</strong> {data.color_label}</div>}
                                {data.unit_price && <div><strong>단가:</strong> <span className="text-lg text-orange-600">{data.unit_price?.toLocaleString()}동</span></div>}
                                {data.total_price && <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{data.total_price?.toLocaleString()}동</span></div>}
                                <div><strong>생성일:</strong> {data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                                {data.request_note && (
                                    <div className="mt-4">
                                        <strong>요청사항:</strong>
                                        <div className="bg-gray-100 p-3 rounded mt-2 text-sm">{data.request_note}</div>
                                    </div>
                                )}
                            </div>
                            {priceInfo && (
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        💰 가격 정보
                                    </h5>
                                    <div><strong>차량명:</strong> {priceInfo.car_name || priceInfo.car_type}</div>
                                    <div><strong>차량 타입:</strong> <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-sm">{priceInfo.car_type}</span></div>
                                    <div><strong>가격:</strong> <span className="text-lg text-green-600">{priceInfo.price?.toLocaleString()}동</span></div>
                                    {priceInfo.capacity && <div><strong>수용 인원:</strong> {priceInfo.capacity}명</div>}
                                    {priceInfo.description && <div><strong>설명:</strong> {priceInfo.description}</div>}
                                </div>
                            )}
                        </div>
                    );

                case 'airport':
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                    <Plane className="w-4 h-4 mr-2" />
                                    ✈️ 공항 서비스 정보
                                </h5>
                                {data.airport_price_code && <div><strong>가격 코드:</strong> <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">{data.airport_price_code}</span></div>}
                                {data.ra_airport_location && <div><strong>공항 위치:</strong> {data.ra_airport_location}</div>}
                                {data.ra_flight_number && <div><strong>항공편 번호:</strong> {data.ra_flight_number}</div>}
                                {data.ra_datetime && <div><strong>출발/도착 일시:</strong> {new Date(data.ra_datetime).toLocaleString('ko-KR')}</div>}
                                {data.ra_passenger_count && <div><strong>승객 수:</strong> {data.ra_passenger_count}명</div>}
                                {data.ra_car_count && <div><strong>차량 수:</strong> {data.ra_car_count}대</div>}
                                {data.ra_luggage_count && <div><strong>수하물 개수:</strong> {data.ra_luggage_count}개</div>}
                                {data.unit_price && <div><strong>단가:</strong> <span className="text-lg text-orange-600">{data.unit_price?.toLocaleString()}동</span></div>}
                                {data.total_price && <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{data.total_price?.toLocaleString()}동</span></div>}
                                <div><strong>생성일:</strong> {data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                                {data.request_note && (
                                    <div className="mt-4">
                                        <strong>요청사항:</strong>
                                        <div className="bg-gray-100 p-3 rounded mt-2 text-sm">{data.request_note}</div>
                                    </div>
                                )}
                            </div>
                            {priceInfo && (
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        💰 가격 정보
                                    </h5>
                                    <div><strong>서비스명:</strong> {priceInfo.airport_name || priceInfo.service_name}</div>
                                    <div><strong>경로:</strong> {priceInfo.airport_route || priceInfo.route}</div>
                                    <div><strong>가격:</strong> <span className="text-lg text-green-600">{priceInfo.price?.toLocaleString()}동</span></div>
                                    {priceInfo.vehicle_type && <div><strong>차량 타입:</strong> {priceInfo.vehicle_type}</div>}
                                    {priceInfo.description && <div><strong>설명:</strong> {priceInfo.description}</div>}
                                </div>
                            )}
                        </div>
                    );

                case 'hotel':
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-purple-600 border-b pb-2 flex items-center">
                                    <Building className="w-4 h-4 mr-2" />
                                    🏨 호텔 정보
                                </h5>
                                {data.hotel_price_code && <div><strong>호텔 가격 코드:</strong> <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">{data.hotel_price_code}</span></div>}
                                {data.checkin_date && <div><strong>체크인 날짜:</strong> {new Date(data.checkin_date).toLocaleDateString('ko-KR')}</div>}
                                <div>
                                    <strong>투숙객 수:</strong>
                                    <span className="font-semibold text-purple-600 text-lg ml-2">
                                        {data.guest_count !== null && data.guest_count !== undefined ? `${data.guest_count}명` : '정보 없음'}
                                    </span>
                                </div>
                                {data.room_count && <div><strong>객실 수:</strong> {data.room_count}개</div>}
                                {data.schedule && <div><strong>일정:</strong> {data.schedule}</div>}
                                {data.hotel_category && <div><strong>호텔 카테고리:</strong> {data.hotel_category}</div>}
                                {data.breakfast_service && <div><strong>조식 서비스:</strong> {data.breakfast_service}</div>}
                                {data.total_price && <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{data.total_price?.toLocaleString()}동</span></div>}
                                <div><strong>생성일:</strong> {data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                                {data.request_note && (
                                    <div className="mt-4">
                                        <strong>요청사항:</strong>
                                        <div className="bg-gray-100 p-3 rounded mt-2 text-sm">{data.request_note}</div>
                                    </div>
                                )}
                            </div>
                            {priceInfo && (
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        💰 가격 정보
                                    </h5>
                                    <div><strong>호텔명:</strong> {priceInfo.hotel_name}</div>
                                    <div><strong>가격:</strong> <span className="text-lg text-green-600">{priceInfo.price?.toLocaleString()}동</span></div>
                                    {priceInfo.room_type && <div><strong>객실 타입:</strong> {priceInfo.room_type}</div>}
                                    {priceInfo.location && <div><strong>위치:</strong> {priceInfo.location}</div>}
                                    {priceInfo.description && <div><strong>설명:</strong> {priceInfo.description}</div>}
                                </div>
                            )}
                        </div>
                    );

                case 'tour':
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-orange-600 border-b pb-2 flex items-center">
                                    <MapPin className="w-4 h-4 mr-2" />
                                    🗺️ 투어 정보
                                </h5>
                                {data.tour_price_code && <div><strong>투어 가격 코드:</strong> <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">{data.tour_price_code}</span></div>}
                                {data.tour_capacity && <div><strong>참가 인원:</strong> {data.tour_capacity}명</div>}
                                {data.pickup_location && <div><strong>픽업 장소:</strong> {data.pickup_location}</div>}
                                {data.dropoff_location && <div><strong>드롭오프 장소:</strong> {data.dropoff_location}</div>}
                                {data.tour_date && <div><strong>투어 날짜:</strong> {new Date(data.tour_date).toLocaleDateString('ko-KR')}</div>}
                                {data.total_price && <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{data.total_price?.toLocaleString()}동</span></div>}
                                <div><strong>생성일:</strong> {data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                                {data.request_note && (
                                    <div className="mt-4">
                                        <strong>요청사항:</strong>
                                        <div className="bg-gray-100 p-3 rounded mt-2 text-sm">{data.request_note}</div>
                                    </div>
                                )}
                            </div>
                            {priceInfo && (
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        💰 가격 정보
                                    </h5>
                                    <div><strong>투어명:</strong> {priceInfo.tour_name}</div>
                                    <div><strong>가격:</strong> <span className="text-lg text-green-600">{priceInfo.price?.toLocaleString()}동</span></div>
                                    {priceInfo.tour_capacity && <div><strong>최대 인원:</strong> {priceInfo.tour_capacity}명</div>}
                                    {priceInfo.tour_vehicle && <div><strong>차량:</strong> {priceInfo.tour_vehicle}</div>}
                                    {priceInfo.tour_type && <div><strong>투어 타입:</strong> {priceInfo.tour_type}</div>}
                                    {priceInfo.description && <div><strong>설명:</strong> {priceInfo.description}</div>}
                                </div>
                            )}
                        </div>
                    );

                case 'rentcar':
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-red-600 border-b pb-2 flex items-center">
                                    <Car className="w-4 h-4 mr-2" />
                                    🚗 렌터카 정보
                                </h5>
                                {data.rentcar_price_code && <div><strong>렌터카 가격 코드:</strong> <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">{data.rentcar_price_code}</span></div>}
                                {data.rentcar_count && <div><strong>렌터카 수:</strong> {data.rentcar_count}대</div>}
                                {data.passenger_count && <div><strong>승객 수:</strong> {data.passenger_count}명</div>}
                                {data.pickup_datetime && <div><strong>픽업 일시:</strong> {new Date(data.pickup_datetime).toLocaleString('ko-KR')}</div>}
                                {data.pickup_location && <div><strong>픽업 장소:</strong> {data.pickup_location}</div>}
                                {data.destination && <div><strong>목적지:</strong> {data.destination}</div>}
                                {data.via_location && <div><strong>경유지:</strong> {data.via_location}</div>}
                                {data.luggage_count && <div><strong>수하물 개수:</strong> {data.luggage_count}개</div>}
                                {data.unit_price && <div><strong>단가:</strong> <span className="text-lg text-orange-600">{data.unit_price?.toLocaleString()}동</span></div>}
                                {data.total_price && <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{data.total_price?.toLocaleString()}동</span></div>}
                                <div><strong>생성일:</strong> {data.created_at ? new Date(data.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                                {data.request_note && (
                                    <div className="mt-4">
                                        <strong>요청사항:</strong>
                                        <div className="bg-gray-100 p-3 rounded mt-2 text-sm">{data.request_note}</div>
                                    </div>
                                )}
                            </div>
                            {priceInfo && (
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-green-600 border-b pb-2 flex items-center">
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        💰 가격 정보
                                    </h5>
                                    <div><strong>차량명:</strong> {priceInfo.rent_name || priceInfo.rent_type}</div>
                                    <div><strong>차량 타입:</strong> {priceInfo.rent_type}</div>
                                    <div><strong>가격:</strong> <span className="text-lg text-green-600">{priceInfo.price?.toLocaleString()}동</span></div>
                                    {priceInfo.rent_category && <div><strong>카테고리:</strong> {priceInfo.rent_category}</div>}
                                    {priceInfo.rent_route && <div><strong>경로:</strong> {priceInfo.rent_route}</div>}
                                    {priceInfo.rent_car_type && <div><strong>차종:</strong> {priceInfo.rent_car_type}</div>}
                                    {priceInfo.description && <div><strong>설명:</strong> {priceInfo.description}</div>}
                                </div>
                            )}
                        </div>
                    );

                default:
                    return <p className="text-gray-500">알 수 없는 서비스 타입: {type}</p>;
            }
        };

        if (loading) {
            return (
                <div className="space-y-3">
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-2 text-gray-600">서비스 상세 정보를 불러오는 중...</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                        <div className="font-semibold text-red-800">오류가 발생했습니다</div>
                        <div className="text-red-700">{error}</div>
                    </div>
                </div>
            );
        }

        if (!serviceData) {
            return (
                <div className="space-y-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                        <div className="font-semibold text-gray-800">서비스 상세 정보를 찾을 수 없습니다</div>
                        <div className="text-gray-600">예약 ID: {reservation?.re_id || reservation?.reservation?.re_id}</div>
                    </div>
                </div>
            );
        }

        const serviceType = reservation?.re_type || reservation?.reservation?.re_type;
        return (
            <div className="space-y-4">
                {renderServiceDetailsByType(serviceType, serviceData, priceData)}
            </div>
        );
    };

    // 서비스별 상세 정보 렌더링 (컴포넌트 내부 함수)
    const renderServiceDetails = (reservation: any) => {
        const details = reservation.service_details;

        if (!details) {
            return <FallbackServiceDetails reservation={reservation} />;
        }

        switch (reservation.re_type) {
            case 'cruise':
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-blue-600 border-b pb-2">🚢 크루즈 정보</h5>
                                <div><strong>크루즈명:</strong> <span className="text-blue-700 font-medium">{details.cruise_name || details.room_price_info?.cruise || ''}</span></div>
                                <div><strong>객실명:</strong> <span className="text-blue-700">{details.room_name || details.room_price_info?.room_category || ''}</span></div>
                                <div><strong>객실타입:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{details.room_type || details.room_price_info?.room_type || ''}</span></div>
                                <div><strong>체크인 날짜:</strong> {details.checkin ? new Date(details.checkin).toLocaleDateString('ko-KR') : '미정'}</div>
                                <div>
                                    <strong>투숙객 수:</strong>
                                    <span className="font-semibold text-purple-600 text-lg ml-2">
                                        {details.guest_count !== null && details.guest_count !== undefined ? `${details.guest_count}명` : '정보 없음'}
                                    </span>
                                </div>
                                <div><strong>객실 가격 코드:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{details.room_price_code || ''}</span></div>
                                <div><strong>탑승 지원:</strong> {details.boarding_assist || ''}</div>
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-semibold text-green-600 border-b pb-2">💰 금액 정보</h5>
                                <div><strong>단가:</strong> <span className="text-lg text-orange-600">{details.unit_price?.toLocaleString()}동</span></div>
                                <div><strong>객실 총 금액:</strong> <span className="text-lg font-bold text-green-600">{details.room_total_price?.toLocaleString()}동</span></div>
                                <div><strong>생성일:</strong> {details.created_at ? new Date(details.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                            </div>
                            <div className="space-y-3">
                                <PriceTableInfo serviceType="cruise" priceCode={details.room_price_code} />
                            </div>
                        </div>
                        {/* 요청사항 - 전체 너비로 별도 섹션 */}
                        {details.request_note && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <h5 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    📝 요청사항
                                </h5>
                                <div className="text-gray-900 whitespace-pre-wrap">{details.request_note}</div>
                            </div>
                        )}
                    </>
                );

            case 'cruise_car':
            case 'sht_car':
            case 'car':
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-amber-600 border-b pb-2">🚐 차량 정보</h5>
                                <div><strong>차량 가격 코드:</strong> <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-sm">{details.car_price_code}</span></div>
                                {details.vehicle_number && <div><strong>차량번호:</strong> {details.vehicle_number}</div>}
                                {details.seat_number && <div><strong>좌석 수:</strong> {details.seat_number}석</div>}
                                {details.color_label && <div><strong>색상:</strong> {details.color_label}</div>}
                                <div><strong>단가:</strong> {details.unit_price?.toLocaleString()}동</div>
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-semibold text-blue-600 border-b pb-2">💰 금액 및 메모</h5>
                                <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{details.total_price?.toLocaleString()}동</span></div>
                                <div><strong>생성일:</strong> {details.created_at ? new Date(details.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                            </div>
                            <div className="space-y-3">
                                <PriceTableInfo serviceType="car" priceCode={details.car_price_code} />
                            </div>
                        </div>
                        {details.request_note && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <h5 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    📝 요청사항
                                </h5>
                                <div className="text-gray-900 whitespace-pre-wrap">{details.request_note}</div>
                            </div>
                        )}
                    </>
                );

            case 'airport':
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-green-600 border-b pb-2">✈️ 공항 정보</h5>
                                <div><strong>공항 위치:</strong> <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">{details.ra_airport_location}</span></div>
                                <div><strong>항공편 번호:</strong> {details.ra_flight_number || '미정'}</div>
                                <div><strong>출발/도착 일시:</strong> {details.ra_datetime ? new Date(details.ra_datetime).toLocaleString('ko-KR') : '미정'}</div>
                                <div><strong>가격 코드:</strong> <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">{details.airport_price_code}</span></div>
                                {details.ra_stopover_location && <div><strong>경유지:</strong> {details.ra_stopover_location}</div>}
                                {details.ra_stopover_wait_minutes && <div><strong>경유 대기시간:</strong> {details.ra_stopover_wait_minutes}분</div>}
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-semibold text-blue-600 border-b pb-2">🚗 차량 및 인원</h5>
                                <div><strong>승객 수:</strong> {details.ra_passenger_count}명</div>
                                <div><strong>차량 수:</strong> {details.ra_car_count}대</div>
                                <div><strong>수하물 개수:</strong> {details.ra_luggage_count}개</div>
                                <div><strong>단가:</strong> {details.unit_price?.toLocaleString()}동</div>
                                <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{details.total_price?.toLocaleString()}동</span></div>
                                <div><strong>처리 상태:</strong> {details.ra_is_processed || '미처리'}</div>
                            </div>
                            <div className="space-y-3">
                                <PriceTableInfo serviceType="airport" priceCode={details.airport_price_code} />
                            </div>
                        </div>
                        {details.request_note && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <h5 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    📝 요청사항
                                </h5>
                                <div className="text-gray-900 whitespace-pre-wrap">{details.request_note}</div>
                            </div>
                        )}
                    </>
                );

            case 'hotel':
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-purple-600 border-b pb-2">🏨 호텔 정보</h5>
                                <div><strong>체크인 날짜:</strong> {details.checkin_date ? new Date(details.checkin_date).toLocaleDateString('ko-KR') : '미정'}</div>
                                <div><strong>호텔 카테고리:</strong> <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">{details.hotel_category}</span></div>
                                <div><strong>호텔 가격 코드:</strong> <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">{details.hotel_price_code}</span></div>
                                <div><strong>일정:</strong> {details.schedule || '정보 없음'}</div>
                                {details.breakfast_service && <div><strong>조식 서비스:</strong> {details.breakfast_service}</div>}
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-semibold text-blue-600 border-b pb-2">🛏️ 객실 및 금액</h5>
                                <div>
                                    <strong>투숙객 수:</strong>
                                    <span className="font-semibold text-purple-600 text-lg ml-2">
                                        {details.guest_count !== null && details.guest_count !== undefined ? `${details.guest_count}명` : '정보 없음'}
                                    </span>
                                </div>
                                <div><strong>객실 수:</strong> {details.room_count}개</div>
                                <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{details.total_price?.toLocaleString()}동</span></div>
                                <div><strong>생성일:</strong> {details.created_at ? new Date(details.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                            </div>
                            <div className="space-y-3">
                                <PriceTableInfo serviceType="hotel" priceCode={details.hotel_price_code} />
                            </div>
                        </div>
                        {details.request_note && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <h5 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    📝 요청사항
                                </h5>
                                <div className="text-gray-900 whitespace-pre-wrap">{details.request_note}</div>
                            </div>
                        )}
                    </>
                );

            case 'tour':
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-orange-600 border-b pb-2">🗺️ 투어 정보</h5>
                                <div><strong>투어 가격 코드:</strong> <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">{details.tour_price_code}</span></div>
                                <div><strong>참가 인원:</strong> {details.tour_capacity}명</div>
                                <div><strong>픽업 장소:</strong> {details.pickup_location || '미정'}</div>
                                <div><strong>드롭오프 장소:</strong> {details.dropoff_location || '미정'}</div>
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-semibold text-green-600 border-b pb-2">💰 금액 정보</h5>
                                <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{details.total_price?.toLocaleString()}동</span></div>
                                <div><strong>생성일:</strong> {details.created_at ? new Date(details.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                            </div>
                            <div className="space-y-3">
                                <PriceTableInfo serviceType="tour" priceCode={details.tour_price_code} />
                            </div>
                        </div>
                        {details.request_note && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <h5 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    📝 요청사항
                                </h5>
                                <div className="text-gray-900 whitespace-pre-wrap">{details.request_note}</div>
                            </div>
                        )}
                    </>
                );

            case 'rentcar':
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <h5 className="font-semibold text-red-600 border-b pb-2">🚗 렌터카 정보</h5>
                                <div><strong>렌터카 가격 코드:</strong> <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">{details.rentcar_price_code}</span></div>
                                <div><strong>렌터카 수:</strong> {details.rentcar_count}대</div>
                                <div><strong>차량 수:</strong> {details.car_count || '정보 없음'}대</div>
                                <div><strong>단가:</strong> {details.unit_price?.toLocaleString()}동</div>
                                <div><strong>픽업 일시:</strong> {details.pickup_datetime ? new Date(details.pickup_datetime).toLocaleString('ko-KR') : '미정'}</div>
                            </div>
                            <div className="space-y-3">
                                <h5 className="font-semibold text-blue-600 border-b pb-2">📍 이동 경로 및 승객</h5>
                                <div><strong>승객 수:</strong> {details.passenger_count}명</div>
                                <div><strong>픽업 장소:</strong> {details.pickup_location || '미정'}</div>
                                <div><strong>목적지:</strong> {details.destination || '미정'}</div>
                                {details.via_location && <div><strong>경유지:</strong> {details.via_location}</div>}
                                {details.via_waiting && <div><strong>경유 대기:</strong> {details.via_waiting}</div>}
                                <div><strong>수하물 개수:</strong> {details.luggage_count}개</div>
                                <div><strong>총 금액:</strong> <span className="text-lg font-bold text-green-600">{details.total_price?.toLocaleString()}동</span></div>
                                <div><strong>생성일:</strong> {details.created_at ? new Date(details.created_at).toLocaleString('ko-KR') : '정보 없음'}</div>
                            </div>
                            <div className="space-y-3">
                                <PriceTableInfo serviceType="rentcar" priceCode={details.rentcar_price_code} />
                            </div>
                        </div>
                        {details.request_note && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <h5 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    📝 요청사항
                                </h5>
                                <div className="text-gray-900 whitespace-pre-wrap">{details.request_note}</div>
                            </div>
                        )}
                    </>
                );

            default:
                return <p className="text-gray-500">알 수 없는 서비스 타입</p>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="예약 목록으로 돌아가기"
                            >
                                <ChevronLeft className="w-6 h-6 text-gray-600" />
                            </button>
                        )}
                        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-600" />
                    </button>
                </div>

                {/* 예약 현황 요약 (컴팩트) */}
                {selectedUser?.statusCounts && (
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                        <div className="flex items-center gap-6 text-sm">
                            <span className="text-gray-600 font-medium">📊 예약 현황:</span>
                            <div className="flex items-center gap-1">
                                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">
                                    대기 {selectedUser.statusCounts.pending || 0}건
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                    확정 {selectedUser.statusCounts.confirmed || 0}건
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                                    취소 {selectedUser.statusCounts.cancelled || 0}건
                                </span>
                            </div>
                            <div className="flex items-center gap-1 ml-auto">
                                <span className="text-gray-500 text-xs">
                                    총 {(selectedUser.statusCounts.pending || 0) + (selectedUser.statusCounts.confirmed || 0) + (selectedUser.statusCounts.cancelled || 0)}건
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-8 space-y-8">
                    {/* 통합 정보 카드들 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 gap-8">
                        {/* 예약자 정보 */}
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                            <h4 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                                <User className="w-5 h-5 mr-2" />
                                예약자 정보
                            </h4>
                            <div className="space-y-3 text-sm">
                                <div><strong>이름:</strong> {safeText(userInfo?.name ?? reservation.users?.name ?? reservation.customer_name ?? '')}</div>
                                <div><strong>영문이름:</strong> {safeText(userInfo?.english_name ?? reservation.customer_english_name ?? '')}</div>
                                <div><strong>닉네임:</strong> {safeText(userInfo?.nickname ?? reservation.customer_nickname ?? '')}</div>
                                <div className="flex items-center gap-1">
                                    <strong>이메일:</strong>
                                    <span className="flex items-center gap-1 ml-1">
                                        <Mail className="w-3 h-3" />
                                        {safeText(userInfo?.email ?? reservation.users?.email ?? reservation.customer_email ?? reservation.email ?? '')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 예약 기본 정보 */}
                        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                            <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2" />
                                예약 기본 정보
                            </h4>
                            <div className="space-y-2 text-sm">
                                <div><strong>예약 ID:</strong> <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{reservation.re_id || reservation.reservation?.re_id}</span></div>
                                <div><strong>견적 ID:</strong> {safeText(reservation.re_quote_id || reservation.reservation?.re_quote_id, '정보 없음')}</div>
                                <div><strong>서비스 타입:</strong> <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">{getServiceName(reservation.re_type || reservation.reservation?.re_type)}</span></div>
                                <div><strong>예약일:</strong> {(reservation.re_created_at || reservation.reservation?.re_created_at) ? new Date(reservation.re_created_at || reservation.reservation?.re_created_at).toLocaleDateString('ko-KR') : '정보 없음'}</div>
                            </div>
                        </div>

                        {/* 상태 및 관리 */}
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                                <Calendar className="w-5 h-5 mr-2" />
                                처리 상태
                            </h4>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <strong>상태:</strong>
                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${currentStatus === 'confirmed'
                                        ? 'bg-green-100 text-green-800'
                                        : currentStatus === 'pending'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : currentStatus === 'cancelled'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {currentStatus === 'confirmed'
                                            ? '확정'
                                            : currentStatus === 'pending'
                                                ? '대기중'
                                                : currentStatus === 'cancelled'
                                                    ? '취소'
                                                    : currentStatus || '정보 없음'}
                                    </span>
                                </div>

                                {/* 확정 버튼 - pending 상태일 때만 표시 */}
                                {currentStatus === 'pending' && (
                                    <div className="pt-2">
                                        <button
                                            onClick={handleConfirmReservation}
                                            disabled={confirming}
                                            className={`w-full px-4 py-2 rounded-lg font-semibold transition-all ${confirming
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
                                                }`}
                                        >
                                            {confirming ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    처리중...
                                                </span>
                                            ) : (
                                                '✅ 예약 확정하기'
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* 이미 확정된 경우 안내 */}
                                {currentStatus === 'confirmed' && (
                                    <div className="pt-2 bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                                        <p className="text-green-800 font-semibold">✅ 확정 완료된 예약입니다</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 결제 계산된 서비스 정보 */}
                    {reservation.serviceData?.services && reservation.serviceData.services.length > 0 && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                            <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                                <CreditCard className="w-5 h-5 mr-2" />
                                💰 서비스별 금액 상세
                            </h3>
                            <div className="space-y-3">
                                {reservation.serviceData.services.map((service: any, idx: number) => (
                                    <div key={idx} className="bg-white p-4 rounded border border-blue-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-blue-800">{service.type}</span>
                                            <span className="font-bold text-blue-700 text-lg">{service.amount?.toLocaleString() || 0}동</span>
                                        </div>
                                        <div className="text-sm text-blue-600">
                                            {service.unitPrice?.toLocaleString() || 0}동 × {service.quantity || 1}{service.quantityUnit ? ` ${service.quantityUnit}` : ''} = {service.amount?.toLocaleString() || 0}동
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t border-blue-300 pt-3 flex justify-between text-lg font-bold text-blue-900">
                                    <span>총 계산 금액:</span>
                                    <span>{reservation.serviceData.total?.toLocaleString() || 0}동</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 크루즈 상세 정보 (최우선 표시) */}
                    {(reservation.re_type === 'cruise' || reservation.reservation?.re_type === 'cruise') && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                            <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                                <Ship className="w-5 h-5 mr-2" />
                                🚢 크루즈 상세 정보
                            </h3>
                            <CruiseDetailSection reservation={reservation} />
                        </div>
                    )}

                    {/* 다른 모든 서비스 상세 정보 */}
                    {(reservation.re_type !== 'cruise' && reservation.reservation?.re_type !== 'cruise') && (
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                {getServiceName(reservation.re_type || reservation.reservation?.re_type)} 상세 정보
                            </h3>

                            {/* 다른 서비스 상세 정보 */}
                            <ServiceDetailSection reservation={reservation} />

                            {/* 기존 방식도 유지 (fallback) */}
                            {!['cruise', 'airport', 'hotel', 'tour', 'rentcar'].includes(reservation.re_type || reservation.reservation?.re_type) &&
                                renderServiceDetails(reservation)
                            }
                        </div>
                    )}

                    {/* 해당 고객의 모든 예약 서비스 목록 - 가장 아래로 이동 */}
                    {loadingAllReservations ? (
                        <div className="bg-gray-50 p-8 rounded-lg text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <p className="text-gray-600">고객의 모든 예약을 조회하는 중...</p>
                        </div>
                    ) : allUserReservations.length > 0 ? (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-blue-200">
                            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
                                <Calendar className="w-6 h-6 mr-2" />
                                🎫 예약 서비스 ({allUserReservations.length}건)
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {allUserReservations.map((res: any, index: number) => {
                                    const isCurrentReservation = res.re_id === (reservation.re_id || reservation.reservation?.re_id);
                                    return (
                                        <div
                                            key={res.re_id}
                                            className={`bg-white p-5 rounded-lg border-2 transition-all ${isCurrentReservation
                                                ? 'border-blue-500 shadow-lg'
                                                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-3 pb-2 border-b">
                                                <div className="flex items-center gap-2">
                                                    {res.re_type === 'cruise' && <Ship className="w-5 h-5 text-blue-600" />}
                                                    {res.re_type === 'airport' && <Plane className="w-5 h-5 text-green-600" />}
                                                    {res.re_type === 'hotel' && <Building className="w-5 h-5 text-orange-600" />}
                                                    {res.re_type === 'tour' && <MapPin className="w-5 h-5 text-pink-600" />}
                                                    {res.re_type === 'rentcar' && <Car className="w-5 h-5 text-red-600" />}
                                                    {res.re_type === 'car' && <Car className="w-5 h-5 text-purple-600" />}
                                                    <span className="font-bold text-gray-800">
                                                        {getServiceName(res.re_type)}
                                                    </span>
                                                    {isCurrentReservation && (
                                                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                                            현재
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${res.re_status === 'confirmed'
                                                    ? 'bg-green-100 text-green-800'
                                                    : res.re_status === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {res.re_status === 'confirmed' ? '확정' : res.re_status === 'pending' ? '대기' : '취소'}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                {/* 크루즈 */}
                                                {res.re_type === 'cruise' && (
                                                    <>
                                                        {res.serviceDetails ? (
                                                            <>
                                                                {res.serviceDetails.room_price?.cruise && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">크루즈:</strong>
                                                                        <span className="text-blue-700 font-semibold">
                                                                            {res.serviceDetails.room_price.cruise}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {(res.serviceDetails.room_price?.room_type || res.serviceDetails.room_price?.room_category) && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">객실:</strong>
                                                                        <span>{res.serviceDetails.room_price?.room_type || res.serviceDetails.room_price?.room_category}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.room_price?.route && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">항로:</strong>
                                                                        <span>{res.serviceDetails.room_price.route}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.checkin && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">체크인:</strong>
                                                                        <span>{new Date(res.serviceDetails.checkin).toLocaleDateString('ko-KR')}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.boarding_code && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">승선코드:</strong>
                                                                        <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">{res.serviceDetails.boarding_code}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.guest_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">인원:</strong>
                                                                        <span>{res.serviceDetails.guest_count}명</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.unit_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">단가:</strong>
                                                                        <span className="text-blue-600">{res.serviceDetails.unit_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.room_total_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">총 금액:</strong>
                                                                        <span className="text-blue-700 font-bold">{res.serviceDetails.room_total_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.boarding_assist && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">승선 도움:</strong>
                                                                        <span className="text-green-600">✓ 필요</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.request_note && (
                                                                    <div className="flex flex-col gap-1 pt-2 border-t">
                                                                        <strong className="text-gray-600">요청사항:</strong>
                                                                        <span className="text-xs text-gray-500 whitespace-pre-line">{res.serviceDetails.request_note}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-500 text-xs">상세 정보 로딩 중...</div>
                                                        )}
                                                    </>
                                                )}

                                                {/* 공항 */}
                                                {res.re_type === 'airport' && (
                                                    <>
                                                        {res.serviceDetails ? (
                                                            <>
                                                                {res.serviceDetails.ra_airport_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">공항:</strong>
                                                                        <span>{res.serviceDetails.ra_airport_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.airport_price?.airport_category && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">카테고리:</strong>
                                                                        <span className="text-green-700 font-semibold">{res.serviceDetails.airport_price.airport_category}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.airport_price?.airport_route && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">경로:</strong>
                                                                        <span>{res.serviceDetails.airport_price.airport_route}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.airport_price?.airport_car_type && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량 타입:</strong>
                                                                        <span>{res.serviceDetails.airport_price.airport_car_type}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_datetime && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">일시:</strong>
                                                                        <span>{new Date(res.serviceDetails.ra_datetime).toLocaleString('ko-KR')}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_flight_number && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">항공편:</strong>
                                                                        <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">{res.serviceDetails.ra_flight_number}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_passenger_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">승객 수:</strong>
                                                                        <span>{res.serviceDetails.ra_passenger_count}명</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_car_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량 수:</strong>
                                                                        <span>{res.serviceDetails.ra_car_count}대</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_luggage_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">짐 개수:</strong>
                                                                        <span>{res.serviceDetails.ra_luggage_count}개</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_stopover_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">경유지:</strong>
                                                                        <span>{res.serviceDetails.ra_stopover_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.ra_stopover_wait_minutes > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">대기 시간:</strong>
                                                                        <span>{res.serviceDetails.ra_stopover_wait_minutes}분</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.dispatch_code && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">배차코드:</strong>
                                                                        <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">{res.serviceDetails.dispatch_code}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.total_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">총 금액:</strong>
                                                                        <span className="text-green-700 font-bold">{res.serviceDetails.total_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.request_note && (
                                                                    <div className="flex flex-col gap-1 pt-2 border-t">
                                                                        <strong className="text-gray-600">요청사항:</strong>
                                                                        <span className="text-xs text-gray-500 whitespace-pre-line">{res.serviceDetails.request_note}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-500 text-xs">상세 정보 로딩 중...</div>
                                                        )}
                                                    </>
                                                )}

                                                {/* 호텔 */}
                                                {res.re_type === 'hotel' && (
                                                    <>
                                                        {res.serviceDetails ? (
                                                            <>
                                                                {res.serviceDetails.hotel_price?.hotel_name && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">호텔:</strong>
                                                                        <span className="text-orange-700 font-semibold">{res.serviceDetails.hotel_price.hotel_name}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.hotel_category && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">카테고리:</strong>
                                                                        <span>{res.serviceDetails.hotel_category}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.hotel_price?.room_type && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">객실 타입:</strong>
                                                                        <span>{res.serviceDetails.hotel_price.room_type}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.hotel_price?.location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">위치:</strong>
                                                                        <span>{res.serviceDetails.hotel_price.location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.checkin_date && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">체크인:</strong>
                                                                        <span>{new Date(res.serviceDetails.checkin_date).toLocaleDateString('ko-KR')}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.schedule && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">일정:</strong>
                                                                        <span>{res.serviceDetails.schedule}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.room_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">객실 수:</strong>
                                                                        <span>{res.serviceDetails.room_count}실</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.guest_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">투숙객:</strong>
                                                                        <span>{res.serviceDetails.guest_count}명</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.breakfast_service && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">조식:</strong>
                                                                        <span>{res.serviceDetails.breakfast_service}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.assignment_code && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">배정코드:</strong>
                                                                        <span className="font-mono text-xs bg-orange-100 px-2 py-1 rounded">{res.serviceDetails.assignment_code}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.total_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">총 금액:</strong>
                                                                        <span className="text-orange-700 font-bold">{res.serviceDetails.total_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.request_note && (
                                                                    <div className="flex flex-col gap-1 pt-2 border-t">
                                                                        <strong className="text-gray-600">요청사항:</strong>
                                                                        <span className="text-xs text-gray-500 whitespace-pre-line">{res.serviceDetails.request_note}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-500 text-xs">상세 정보 로딩 중...</div>
                                                        )}
                                                    </>
                                                )}

                                                {/* 투어 */}
                                                {res.re_type === 'tour' && (
                                                    <>
                                                        {res.serviceDetails ? (
                                                            <>
                                                                {res.serviceDetails.tour_price?.tour_name && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">투어:</strong>
                                                                        <span className="text-pink-700 font-semibold">{res.serviceDetails.tour_price.tour_name}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.tour_price?.category && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">카테고리:</strong>
                                                                        <span>{res.serviceDetails.tour_price.category}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.tour_price?.location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">위치:</strong>
                                                                        <span>{res.serviceDetails.tour_price.location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.usage_date && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">이용일:</strong>
                                                                        <span>{new Date(res.serviceDetails.usage_date).toLocaleDateString('ko-KR')}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.pickup_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">픽업:</strong>
                                                                        <span>{res.serviceDetails.pickup_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.dropoff_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">하차:</strong>
                                                                        <span>{res.serviceDetails.dropoff_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.tour_capacity > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">정원:</strong>
                                                                        <span>{res.serviceDetails.tour_capacity}명</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.total_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">총 금액:</strong>
                                                                        <span className="text-pink-700 font-bold">{res.serviceDetails.total_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.request_note && (
                                                                    <div className="flex flex-col gap-1 pt-2 border-t">
                                                                        <strong className="text-gray-600">요청사항:</strong>
                                                                        <span className="text-xs text-gray-500 whitespace-pre-line">{res.serviceDetails.request_note}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-500 text-xs">상세 정보 로딩 중...</div>
                                                        )}
                                                    </>
                                                )}

                                                {/* 렌터카 */}
                                                {res.re_type === 'rentcar' && (
                                                    <>
                                                        {res.serviceDetails ? (
                                                            <>
                                                                {res.serviceDetails.rentcar_price?.vehicle_type && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량:</strong>
                                                                        <span className="text-red-700 font-semibold">{res.serviceDetails.rentcar_price.vehicle_type}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.rentcar_price?.category && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">카테고리:</strong>
                                                                        <span>{res.serviceDetails.rentcar_price.category}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.pickup_datetime && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">픽업 일시:</strong>
                                                                        <span>{new Date(res.serviceDetails.pickup_datetime).toLocaleString('ko-KR')}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.pickup_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">픽업:</strong>
                                                                        <span>{res.serviceDetails.pickup_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.destination && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">목적지:</strong>
                                                                        <span>{res.serviceDetails.destination}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.via_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">경유지:</strong>
                                                                        <span>{res.serviceDetails.via_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.via_waiting && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">경유 대기:</strong>
                                                                        <span>{res.serviceDetails.via_waiting}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.car_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량 수:</strong>
                                                                        <span>{res.serviceDetails.car_count}대</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.passenger_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">승객:</strong>
                                                                        <span>{res.serviceDetails.passenger_count}명</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.luggage_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">짐:</strong>
                                                                        <span>{res.serviceDetails.luggage_count}개</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.dispatch_code && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">배차코드:</strong>
                                                                        <span className="font-mono text-xs bg-red-100 px-2 py-1 rounded">{res.serviceDetails.dispatch_code}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.total_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">총 금액:</strong>
                                                                        <span className="text-red-700 font-bold">{res.serviceDetails.total_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.request_note && (
                                                                    <div className="flex flex-col gap-1 pt-2 border-t">
                                                                        <strong className="text-gray-600">요청사항:</strong>
                                                                        <span className="text-xs text-gray-500 whitespace-pre-line">{res.serviceDetails.request_note}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-500 text-xs">상세 정보 로딩 중...</div>
                                                        )}
                                                    </>
                                                )}

                                                {/* 차량 (크루즈 차량 + SHT 차량) */}
                                                {res.re_type === 'car' && (
                                                    <>
                                                        {res.serviceDetails ? (
                                                            <>
                                                                {res.serviceDetails.car_price?.car_type && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량 타입:</strong>
                                                                        <span className="text-purple-700 font-semibold">{res.serviceDetails.car_price.car_type}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.car_price?.car_category && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">카테고리:</strong>
                                                                        <span>{res.serviceDetails.car_price.car_category}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.car_price?.cruise && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">크루즈:</strong>
                                                                        <span>{res.serviceDetails.car_price.cruise}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.sht_category && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">SHT 카테고리:</strong>
                                                                        <span>{res.serviceDetails.sht_category}</span>
                                                                    </div>
                                                                )}
                                                                {(res.serviceDetails.pickup_datetime || res.serviceDetails.usage_date) && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">이용일:</strong>
                                                                        <span>{new Date(res.serviceDetails.pickup_datetime || res.serviceDetails.usage_date).toLocaleDateString('ko-KR')}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.pickup_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">픽업:</strong>
                                                                        <span>{res.serviceDetails.pickup_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.dropoff_location && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">하차:</strong>
                                                                        <span>{res.serviceDetails.dropoff_location}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.vehicle_number && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량번호:</strong>
                                                                        <span className="font-mono text-xs bg-purple-100 px-2 py-1 rounded">{res.serviceDetails.vehicle_number}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.seat_number && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">좌석:</strong>
                                                                        <span>{res.serviceDetails.seat_number}석</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.car_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">차량 수:</strong>
                                                                        <span>{res.serviceDetails.car_count}대</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.passenger_count > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">승객:</strong>
                                                                        <span>{res.serviceDetails.passenger_count}명</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.dispatch_code && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">배차코드:</strong>
                                                                        <span className="font-mono text-xs bg-purple-100 px-2 py-1 rounded">{res.serviceDetails.dispatch_code}</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.car_total_price && (
                                                                    <div className="flex items-center gap-2">
                                                                        <strong className="text-gray-600">총 금액:</strong>
                                                                        <span className="text-purple-700 font-bold">{res.serviceDetails.car_total_price.toLocaleString()}동</span>
                                                                    </div>
                                                                )}
                                                                {res.serviceDetails.request_note && (
                                                                    <div className="flex flex-col gap-1 pt-2 border-t">
                                                                        <strong className="text-gray-600">요청사항:</strong>
                                                                        <span className="text-xs text-gray-500 whitespace-pre-line">{res.serviceDetails.request_note}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-500 text-xs">상세 정보 로딩 중...</div>
                                                        )}
                                                    </>
                                                )}

                                                <div className="flex items-center gap-2 pt-2 border-t">
                                                    <Clock className="w-3 h-3 text-gray-400" />
                                                    <span className="text-xs text-gray-500">
                                                        예약일: {new Date(res.re_created_at).toLocaleDateString('ko-KR')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
