
"use client";
import React, { useEffect, useMemo, useState } from "react";
import ManagerLayout from "../../../../components/ManagerLayout";
import supabase from "@/lib/supabase";
import { Calendar, Car, Loader2, Printer } from "lucide-react";

type GroupMode = "day" | "vehicle" | "category";
type ViewMode = "table" | "card";

interface ShtCarRow {
    id: string;
    reservation_id: string;
    usage_date: string | null;
    vehicle_number: string | null;
    seat_number: string | null;
    sht_category: string | null;
    created_at?: string;
    // optional enriched fields
    pickup_location?: string | null;
    dropoff_location?: string | null;
    pickup_datetime?: string | null;
    booker_name?: string | null;
    booker_email?: string | null;
    pier_location?: string | null;
    cruise_name?: string | null;
}

const toStartOfDayISO = (d: Date) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString();
};

const toEndOfDayISO = (d: Date) => {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt.toISOString();
};

const fmtDate = (v?: string | null) => {
    if (!v) return "-";
    try {
        return new Date(v).toLocaleDateString("ko-KR");
    } catch {
        return v as string;
    }
};

const labelCategory = (cat?: string | null) => {
    if (!cat) return "미지정";
    const norm = cat.toLowerCase();
    if (norm === "pickup" || norm.includes("pick")) return "픽업";
    if (norm === "dropoff" || norm === "drop-off" || norm === "drop off" || norm === "drop" || norm.includes("drop")) return "드랍";
    if (cat.includes("하차") || cat.includes("드랍")) return "드랍";
    return cat;
};

export default function ManagerReportShtCarPage() {
    const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [groupMode, setGroupMode] = useState<GroupMode>("day");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<ShtCarRow[]>([]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const fromISO = toStartOfDayISO(new Date(startDate));
                const toISO = toEndOfDayISO(new Date(endDate));

                // vw_manager_sht_car_report 뷰에서 선착장 정보 포함하여 조회
                const { data: shtData, error: shtError } = await supabase
                    .from("vw_manager_sht_car_report")
                    .select(`
                        id,
                        reservation_id,
                        usage_date,
                        vehicle_number,
                        seat_number,
                        sht_category,
                        pickup_location,
                        dropoff_location,
                        pickup_datetime,
                        booker_name,
                        booker_email,
                        pier_location,
                        cruise_name,
                        created_at
                    `)
                    .gte("usage_date", fromISO)
                    .lte("usage_date", toISO)
                    .order("usage_date", { ascending: true });

                console.log("🚗 SHT 차량 데이터 조회 결과:", shtData?.length, "건");
                if (shtData?.length > 0) {
                    console.log("📍 첫 번째 데이터 샘플:", {
                        pickup_location: shtData[0].pickup_location,
                        dropoff_location: shtData[0].dropoff_location,
                        sht_category: shtData[0].sht_category,
                        pier_location: shtData[0].pier_location,
                        cruise_name: shtData[0].cruise_name
                    });
                }

                if (shtError) throw shtError;
                if (!mounted) return;

                if (!shtData || shtData.length === 0) {
                    setRows([]);
                    return;
                }

                // 데이터 변환 (뷰에서 직접 모든 정보 포함)
                const enriched: ShtCarRow[] = shtData.map((r: any) => ({
                    id: r.id,
                    reservation_id: r.reservation_id,
                    usage_date: r.usage_date,
                    vehicle_number: r.vehicle_number,
                    seat_number: r.seat_number,
                    sht_category: r.sht_category,
                    created_at: r.created_at,
                    pickup_location: r.pickup_location || null,
                    dropoff_location: r.dropoff_location || null,
                    pickup_datetime: r.pickup_datetime || null,
                    booker_name: r.booker_name || null,
                    booker_email: r.booker_email || null,
                    pier_location: r.pier_location || null,
                    cruise_name: r.cruise_name || null,
                }));

                // 중복 제거
                const byId = new Map<string, ShtCarRow>();
                enriched.forEach((r) => {
                    if (r.id && !byId.has(r.id)) byId.set(r.id, r);
                });

                console.log("✅ 처리된 데이터:", Array.from(byId.values()).length, "건");
                console.log("📍 위치 정보 샘플:", Array.from(byId.values()).slice(0, 3).map(r => ({
                    id: r.id,
                    pickup: r.pickup_location,
                    dropoff: r.dropoff_location,
                    pier: r.pier_location,
                    category: r.sht_category
                })));

                setRows(Array.from(byId.values()));

            } catch (err: any) {
                if (!mounted) return;
                console.error("SHT 차량 데이터 로드 오류:", err);
                setError(err?.message || "데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                if (!mounted) return;
                setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [startDate, endDate]);

    const grouped = useMemo(() => {
        const groups = new Map<string, ShtCarRow[]>();
        const keyOf = (r: ShtCarRow) => {
            if (groupMode === "vehicle") return r.vehicle_number || "미지정";
            if (groupMode === "category") return labelCategory(r.sht_category);
            const d = r.usage_date ? new Date(r.usage_date).toISOString().slice(0, 10) : "미지정";
            return d;
        };
        rows.forEach((r) => {
            const k = keyOf(r);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k)!.push(r);
        });
        const entries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        return entries.map(([key, items]) => ({ key, items }));
    }, [rows, groupMode]);

    const computePrintTitle = () => {
        const s = startDate;
        const e = endDate;
        const period = s === e ? s : `${s}~${e}`;
        return `${period} 스하 차량 배차표`;
    };

    const handlePrint = () => {
        if (typeof window === "undefined") return;
        const prevTitle = document.title;
        const newTitle = computePrintTitle();
        const restore = () => {
            document.title = prevTitle;
            window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore);
        document.title = newTitle;
        window.print();
        // Fallback restore in case afterprint doesn't fire
        setTimeout(() => {
            document.title = prevTitle;
            window.removeEventListener("afterprint", restore);
        }, 5000);
    };
    // 행 단위 판별: 카테고리 텍스트 + 위치 필드까지 고려 (다국어/표기 변형 포함)
    const isPickupRow = (r: ShtCarRow) => {
        const cat = (r.sht_category || "").toLowerCase();
        const pickLoc = (r.pickup_location || "").toLowerCase();
        return /pickup|pick|픽업/i.test(cat) || /pickup|pick|픽업/i.test(pickLoc) || !!r.pickup_location;
    };
    const isDropoffRow = (r: ShtCarRow) => {
        const cat = (r.sht_category || "").toLowerCase();
        const dropLoc = (r.dropoff_location || "").toLowerCase();
        return /dropoff|drop|드랍|하차/i.test(cat) || /dropoff|drop|드랍|하차/i.test(dropLoc) || !!r.dropoff_location;
    };

    return (
        <ManagerLayout title="스하 차량 리포트" activeTab="reports-sht-car">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4 print:hidden">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">시작일</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">종료일</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm"
                        />
                    </div>
                    <div className="w-full md:w-auto">
                        <div className="flex items-center gap-3">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">그룹화</label>
                                <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
                                    <button
                                        onClick={() => setGroupMode("day")}
                                        className={`px-3 py-1 text-sm ${groupMode === "day" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
                                        title="일별"
                                    >
                                        일별
                                    </button>
                                    <button
                                        onClick={() => setGroupMode("vehicle")}
                                        className={`px-3 py-1 text-sm ${groupMode === "vehicle" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
                                        title="차량별"
                                    >
                                        차량별
                                    </button>
                                    <button
                                        onClick={() => setGroupMode("category")}
                                        className={`px-3 py-1 text-sm ${groupMode === "category" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
                                        title="구분별"
                                    >
                                        구분별
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">보기</label>
                                <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
                                    <button
                                        onClick={() => setViewMode("table")}
                                        className={`px-3 py-1 text-sm ${viewMode === "table" ? "bg-green-600 text-white" : "bg-white text-gray-700"}`}
                                        title="테이블"
                                    >
                                        테이블
                                    </button>
                                    <button
                                        onClick={() => setViewMode("card")}
                                        className={`px-3 py-1 text-sm ${viewMode === "card" ? "bg-green-600 text-white" : "bg-white text-gray-700"}`}
                                        title="카드"
                                    >
                                        카드
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrint} className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">
                        <Printer className="w-4 h-4" /> 인쇄
                    </button>
                </div>
            </div>

            <div className="hidden print:block mb-3">
                <div className="text-center">
                    <h1 className="text-xl font-bold">스하 차량 리포트</h1>
                    <div className="text-sm text-gray-700 mt-1">
                        기간: {startDate} ~ {endDate} · 그룹화: {groupMode === "day" ? "일별" : groupMode === "vehicle" ? "차량별" : "구분별"}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 불러오는 중...
                    </div>
                ) : error ? (
                    <div className="p-6 text-red-600 text-sm">{error}</div>
                ) : grouped.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">데이터가 없습니다.</div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {grouped.map((g) => (
                            <div key={g.key} className="break-inside-avoid">
                                <div className="px-4 py-2 bg-gray-50 flex items-center gap-2 print:bg-white">
                                    {groupMode === "day" ? <Calendar className="w-4 h-4 text-blue-600" /> : <Car className="w-4 h-4 text-blue-600" />}
                                    <span className="font-semibold text-gray-800">{g.key}</span>
                                    <span className="ml-2 text-xs text-gray-500">총 {g.items.length}건</span>
                                </div>
                                <div className="overflow-x-auto">
                                    {viewMode === "table" ? (
                                        <div className="space-y-4">
                                            {g.items.filter((it) => isPickupRow(it)).length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="text-sm font-semibold text-green-700 mb-2 px-3">📍 픽업 (승차위치 → 선착장)</h4>
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 print:bg-white">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">구분</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">사용일자</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">예약자</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">차량번호</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">좌석번호</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">승차위치</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">선착장</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {g.items
                                                                .filter((it) => isPickupRow(it))
                                                                .map((r) => (
                                                                    <tr key={r.id} className="border-t border-gray-100">
                                                                        <td className="px-3 py-2">{labelCategory(r.sht_category)}</td>
                                                                        <td className="px-3 py-2">{fmtDate(r.usage_date)}</td>
                                                                        <td className="px-3 py-2">{r.booker_name || r.booker_email || "-"}</td>
                                                                        <td className="px-3 py-2">{r.vehicle_number || "-"}</td>
                                                                        <td className="px-3 py-2">{r.seat_number || "-"}</td>
                                                                        <td className="px-3 py-2">{r.pickup_location || "-"}</td>
                                                                        <td className="px-3 py-2">{r.pier_location || "-"}</td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {g.items.filter((it) => isDropoffRow(it) && !isPickupRow(it)).length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="text-sm font-semibold text-red-700 mb-2 px-3">📍 드랍 (선착장 → 하차위치)</h4>
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 print:bg-white">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">구분</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">사용일자</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">예약자</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">차량번호</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">좌석번호</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">선착장</th>
                                                                <th className="px-3 py-2 text-left text-xs text-gray-600">하차위치</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {g.items
                                                                .filter((it) => isDropoffRow(it) && !isPickupRow(it))
                                                                .map((r) => (
                                                                    <tr key={r.id} className="border-t border-gray-100">
                                                                        <td className="px-3 py-2">{labelCategory(r.sht_category)}</td>
                                                                        <td className="px-3 py-2">{fmtDate(r.usage_date)}</td>
                                                                        <td className="px-3 py-2">{r.booker_name || r.booker_email || "-"}</td>
                                                                        <td className="px-3 py-2">{r.vehicle_number || "-"}</td>
                                                                        <td className="px-3 py-2">{r.seat_number || "-"}</td>
                                                                        <td className="px-3 py-2">{r.pier_location || "-"}</td>
                                                                        <td className="px-3 py-2">{r.dropoff_location || "-"}</td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {g.items.map((r) => {
                                                return (
                                                    <div key={r.id} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm break-inside-avoid">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="text-base font-semibold text-gray-800">{r.booker_name || r.booker_email || fmtDate(r.usage_date)}</div>
                                                            <div className="text-xs px-2 py-0.5 rounded bg-blue-50 text-black border border-blue-100">{labelCategory(r.sht_category)}</div>
                                                        </div>
                                                        <div className="text-sm text-gray-500 mb-2">{fmtDate(r.usage_date)}</div>
                                                        <div className="text-sm text-gray-700 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-black border border-green-100">차량</span>
                                                                <span className="text-sm font-medium text-gray-700">{r.vehicle_number || "-"}</span>
                                                                <span className="text-gray-400 mx-2">·</span>
                                                                <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-black border border-green-100">좌석</span>
                                                                <span className="text-sm font-medium text-gray-700">{r.seat_number || "-"}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-sm text-gray-600 space-y-2">
                                                            {/* 픽업 행인 경우: 승차위치 → 선착장 순서 */}
                                                            {isPickupRow(r) && (
                                                                <>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-black border border-green-100">승차</span>
                                                                        <span className="text-sm font-medium text-gray-700">{r.pickup_location || "-"}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-black border border-blue-100">선착장</span>
                                                                        <span className="text-sm font-medium text-gray-700">{r.pier_location || "-"}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {/* 드랍 행인 경우: 선착장 → 하차위치 순서 */}
                                                            {isDropoffRow(r) && !isPickupRow(r) && (
                                                                <>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-black border border-blue-100">선착장</span>
                                                                        <span className="text-sm font-medium text-gray-700">{r.pier_location || "-"}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-black border border-red-100">하차</span>
                                                                        <span className="text-sm font-medium text-gray-700">{r.dropoff_location || "-"}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @media print {
                    nav, aside, header, footer { display: none !important; }
                    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                    body { background: #fff; }
                }
            `}</style>
        </ManagerLayout>
    );
}
