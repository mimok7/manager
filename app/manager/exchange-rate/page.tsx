'use client';

import React, { useState, useEffect } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import { getExchangeRate, formatExchangeRate, vndToKrw } from '../../../lib/exchangeRate';
import supabase from '@/lib/supabase';

export default function ManagerExchangeRatePage() {
    const [exchangeRateData, setExchangeRateData] = useState({
        currency: 'VND',
        rate: 5.29,
        lastUpdated: '',
        source: 'db'
    });
    const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
    const [manualRateInput, setManualRateInput] = useState('');
    const [vndInput, setVndInput] = useState('1000000');
    const [krwResult, setKrwResult] = useState(0);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);

    // 사용자 역할 확인
    useEffect(() => {
        const checkUserRole = async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    console.error('User not authenticated:', userError);
                    return;
                }

                const { data: userData, error: roleError } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (!roleError && userData) {
                    setUserRole(userData.role);
                }
            } catch (error) {
                console.error('Error checking user role:', error);
            } finally {
                setLoading(false);
            }
        };

        checkUserRole();
    }, []);

    // 환율 데이터 로드
    const loadExchangeRate = async () => {
        try {
            setExchangeRateLoading(true);

            // 서버 API에서 읽기
            const resp = await fetch('/api/exchange-rate?currency=VND');
            if (resp.ok) {
                const json = await resp.json();
                if (json?.success && json.data) {
                    const d = json.data;
                    setExchangeRateData({
                        currency: d.currency_code || 'VND',
                        rate: d.rate_to_krw || 5.29,
                        lastUpdated: d.last_updated || '',
                        source: 'db'
                    });
                    setManualRateInput((d.rate_to_krw || 5.29).toString());
                    return;
                }
            }

            // API 실패 시 로컬 저장소에서 읽기
            const fallbackRate = await getExchangeRate('VND');
            if (fallbackRate) {
                setExchangeRateData({
                    currency: fallbackRate.currency_code || 'VND',
                    rate: fallbackRate.rate_to_krw || 5.29,
                    lastUpdated: fallbackRate.last_updated || '',
                    source: fallbackRate.source || 'local'
                });
                setManualRateInput(String(fallbackRate.rate_to_krw || 5.29));
                return;
            }
        } catch (error) {
            console.error('환율 데이터 로드 실패:', error);
        } finally {
            setExchangeRateLoading(false);
        }
    };

    // 환율 업데이트 (관리자만 가능)
    const updateExchangeRate = async () => {
        if (!manualRateInput || isNaN(parseFloat(manualRateInput))) {
            alert('올바른 환율을 입력해주세요.');
            return;
        }

        const rate = parseFloat(manualRateInput);
        if (rate <= 0) {
            alert('환율은 0보다 큰 수여야 합니다.');
            return;
        }

        try {
            setExchangeRateLoading(true);

            const resp = await fetch('/api/exchange-rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currency_code: 'VND',
                    rate_to_krw: rate
                })
            });

            if (resp.ok) {
                const json = await resp.json();
                if (json.success) {
                    setExchangeRateData(prev => ({
                        ...prev,
                        rate: rate,
                        lastUpdated: new Date().toISOString(),
                        source: 'db'
                    }));
                    alert('환율이 성공적으로 업데이트되었습니다.');
                } else {
                    throw new Error(json.message || '업데이트 실패');
                }
            } else {
                throw new Error('서버 오류');
            }
        } catch (error) {
            console.error('환율 업데이트 실패:', error);
            alert('환율 업데이트에 실패했습니다. 관리자에게 문의하세요.');
        } finally {
            setExchangeRateLoading(false);
        }
    };

    // 컴포넌트 마운트 시 환율 로드
    useEffect(() => {
        loadExchangeRate();
    }, []);

    // VND 입력 변경 시 자동 계산
    useEffect(() => {
        const vnd = parseInt(vndInput) || 0;
        const result = vndToKrw(vnd, exchangeRateData.rate);
        setKrwResult(result);
    }, [vndInput, exchangeRateData.rate]);

    if (loading) {
        return (
            <ManagerLayout title="환율 관리" activeTab="exchange-rate">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="ml-4 text-gray-600">로딩 중...</p>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="환율 관리" activeTab="exchange-rate">
            <div className="space-y-6">
                {/* 현재 환율 정보 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">💱 현재 환율 정보</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-sm text-blue-600 font-medium">통화</div>
                            <div className="text-lg font-bold text-blue-800">{exchangeRateData.currency}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-sm text-green-600 font-medium">현재 환율</div>
                            <div className="text-lg font-bold text-green-800">
                                100동 = {formatExchangeRate(exchangeRateData.rate)}원
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600 font-medium">최종 업데이트</div>
                            <div className="text-sm text-gray-800">
                                {exchangeRateData.lastUpdated
                                    ? new Date(exchangeRateData.lastUpdated).toLocaleString('ko-KR')
                                    : '정보 없음'
                                }
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                데이터 출처: {exchangeRateData.source === 'db' ? '데이터베이스' : '로컬 저장소'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 환율 계산기 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">🧮 환율 계산기</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                베트남 동 (VND) 입력
                            </label>
                            <input
                                type="number"
                                value={vndInput}
                                onChange={(e) => setVndInput(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="금액을 입력하세요"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                한국 원 (KRW) 결과
                            </label>
                            <div className="bg-gray-50 px-3 py-2 border border-gray-300 rounded-lg">
                                <span className="text-lg font-bold text-green-600">
                                    {krwResult.toLocaleString()}원
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-800">
                            ⚠️ <strong>참고사항:</strong> 이 환율은 견적서 작성용 참고 환율입니다.
                            실제 결제 시에는 결제 시점의 환율이 적용될 수 있습니다.
                        </p>
                    </div>
                </div>

                {/* 환율 업데이트 (매니저 및 관리자) */}
                {(userRole === 'manager' || userRole === 'admin') && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">⚙️ 환율 업데이트 (매니저/관리자 전용)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    새 환율 입력 (100동당 원화)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualRateInput}
                                    onChange={(e) => setManualRateInput(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="예: 5.25"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    예시: 5.25 입력 시 → 100동 = 5.25원
                                </p>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={updateExchangeRate}
                                    disabled={exchangeRateLoading}
                                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {exchangeRateLoading ? '업데이트 중...' : '환율 업데이트'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ManagerLayout>
    );
}