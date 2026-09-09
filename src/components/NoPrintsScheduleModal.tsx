import { useState, useMemo } from 'react';
import { type PrintBatchResponse } from '../api/printBatchService';
import { SlashCircle, ChevronLeft, ChevronRight, XLg, CalendarCheck, Search, Building } from 'react-bootstrap-icons';

interface NoPrintsScheduleModalProps {
	isOpen: boolean;
	onClose: () => void;
	batches: PrintBatchResponse[];
	onSelectBatch?: (batch: PrintBatchResponse) => void;
}

function getMonday(d: Date): Date {
	const date = new Date(d);
	const day = date.getDay();
	const diff = date.getDate() - day + (day === 0 ? -6 : 1);
	date.setDate(diff);
	date.setHours(0, 0, 0, 0);
	return date;
}

const DAY_NAMES: Record<number, string> = {
	1: 'Poniedziałek',
	2: 'Wtorek',
	3: 'Środa',
	4: 'Czwartek',
	5: 'Piątek',
	6: 'Sobota',
	0: 'Niedziela',
};

export function NoPrintsScheduleModal({ isOpen, onClose, batches, onSelectBatch }: NoPrintsScheduleModalProps) {
	const [weekOffset, setWeekOffset] = useState<number>(0);
	const [viewMode, setViewMode] = useState<'week' | 'allUpcoming'>('week');
	const [searchTerm, setSearchTerm] = useState<string>('');

	// Obliczamy zakres dat wybranego tygodnia
	const { monday, sunday, dateRangeText, isCurrentWeek } = useMemo(() => {
		const baseMonday = getMonday(new Date());
		baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

		const baseSunday = new Date(baseMonday);
		baseSunday.setDate(baseSunday.getDate() + 6);
		baseSunday.setHours(23, 59, 59, 999);

		const rangeStr = `${baseMonday.toLocaleDateString('pl-PL', {
			day: '2-digit',
			month: '2-digit',
		})} – ${baseSunday.toLocaleDateString('pl-PL', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		})}`;

		return {
			monday: baseMonday,
			sunday: baseSunday,
			dateRangeText: rangeStr,
			isCurrentWeek: weekOffset === 0,
		};
	}, [weekOffset]);

	// Filtrujemy paczki ze statusem NoPrints (4)
	const filteredBatches = useMemo(() => {
		let list = batches.filter((b) => b.status === 4);

		if (searchTerm.trim()) {
			const query = searchTerm.toLowerCase().trim();
			list = list.filter(
				(b) =>
					b.groupName.toLowerCase().includes(query) ||
					b.branchName.toLowerCase().includes(query) ||
					(b.notes && b.notes.toLowerCase().includes(query))
			);
		}

		if (viewMode === 'week') {
			const monTime = monday.getTime();
			const sunTime = sunday.getTime();

			list = list.filter((b) => {
				const bDate = new Date(b.lessonDate).getTime();
				return bDate >= monTime && bDate <= sunTime;
			});
		} else {
			// Wszystkie nadchodzące i bieżący tydzień (od początku bieżącego tygodnia naprzód)
			const currentMonTime = getMonday(new Date()).getTime();
			list = list.filter((b) => new Date(b.lessonDate).getTime() >= currentMonTime);
		}

		// Sortujemy według daty zajęć rosnąco
		list.sort((a, b) => new Date(a.lessonDate).getTime() - new Date(b.lessonDate).getTime());

		return list;
	}, [batches, viewMode, monday, sunday, searchTerm]);

	// Grupowanie według daty zajęć
	const groupedBatches = useMemo(() => {
		const groups: { dateKey: string; dateObj: Date; dayName: string; items: PrintBatchResponse[] }[] = [];

		filteredBatches.forEach((batch) => {
			const d = new Date(batch.lessonDate);
			const dateKey = d.toISOString().split('T')[0];

			let group = groups.find((g) => g.dateKey === dateKey);
			if (!group) {
				const dayOfWeek = d.getDay();
				const dayName = batch.classDayOfWeek !== null && batch.classDayOfWeek !== undefined
					? (DAY_NAMES[batch.classDayOfWeek] || DAY_NAMES[dayOfWeek])
					: DAY_NAMES[dayOfWeek];

				group = {
					dateKey,
					dateObj: d,
					dayName,
					items: [],
				};
				groups.push(group);
			}
			group.items.push(batch);
		});

		return groups;
	}, [filteredBatches]);

	if (!isOpen) return null;

	return (
		<div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
			<div className="animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
				{/* NAGŁÓWEK */}
				<div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-slate-50/70 p-6">
					<div className="flex items-center gap-3.5">
						<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
							<SlashCircle size={22} />
						</span>
						<div>
							<h2 className="text-lg font-black text-slate-900">
								Harmonogram innych technologii (brak wydruków)
							</h2>
							<p className="text-xs text-slate-500 font-medium">
								Grupy, które w danym terminie nie realizują wydruków 3D – nie czekaj na te paczki.
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
						title="Zamknij"
					>
						<XLg size={18} />
					</button>
				</div>

				{/* BELKA STEROWANIA I FILTRÓW */}
				<div className="shrink-0 border-b border-slate-100 bg-white p-4 space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						{/* PRZEŁĄCZNIK WIDOKU */}
						<div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
							<button
								type="button"
								onClick={() => setViewMode('week')}
								className={`cursor-pointer rounded-lg px-3 py-1.5 transition-all ${
									viewMode === 'week' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
								}`}
							>
								Widok tygodnia
							</button>
							<button
								type="button"
								onClick={() => setViewMode('allUpcoming')}
								className={`cursor-pointer rounded-lg px-3 py-1.5 transition-all ${
									viewMode === 'allUpcoming' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
								}`}
							>
								Wszystkie nadchodzące
							</button>
						</div>

						{/* WYSZUKIWARKA */}
						<div className="relative min-w-[200px] flex-1 max-w-xs">
							<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={13} />
							<input
								type="text"
								placeholder="Szukaj grupy lub oddziału..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pr-3 pl-8 text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
							/>
						</div>
					</div>

					{/* NAWIGACJA PO TYGODNIACH (Tylko w trybie 'week') */}
					{viewMode === 'week' && (
						<div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-2.5">
							<button
								type="button"
								onClick={() => setWeekOffset((prev) => prev - 1)}
								className="cursor-pointer flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition-all"
							>
								<ChevronLeft size={13} /> Poprzedni tydzień
							</button>

							<div className="flex items-center gap-2">
								<span className="text-xs font-black text-slate-800">
									{dateRangeText}
								</span>
								{isCurrentWeek ? (
									<span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-black text-purple-700">
										Bieżący tydzień
									</span>
								) : (
									<button
										type="button"
										onClick={() => setWeekOffset(0)}
										className="cursor-pointer rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-purple-100 hover:text-purple-700 transition-colors"
									>
										Wróć do dzisiaj
									</button>
								)}
							</div>

							<button
								type="button"
								onClick={() => setWeekOffset((prev) => prev + 1)}
								className="cursor-pointer flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition-all"
							>
								Następny tydzień <ChevronRight size={13} />
							</button>
						</div>
					)}
				</div>

				{/* LISTA ZGŁOSZEŃ */}
				<div className="scrollbar-thin flex-1 overflow-y-auto p-6 bg-slate-50/40">
					{groupedBatches.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
								<CalendarCheck size={26} />
							</div>
							<h3 className="text-sm font-bold text-slate-700">
								{viewMode === 'week'
									? 'Brak zgłoszeń w wybranym tygodniu'
									: 'Brak nadchodzących zgłoszeń'}
							</h3>
							<p className="mt-1 max-w-sm text-xs text-slate-400">
								Wszystkie grupy mają zaplanowane standardowe wydruki 3D lub trenerzy nie zgłosili jeszcze innej technologii.
							</p>
						</div>
					) : (
						<div className="space-y-6">
							{groupedBatches.map((group) => (
								<div key={group.dateKey} className="space-y-2.5">
									{/* NAGŁÓWEK DNIA */}
									<div className="flex items-center gap-2 border-b border-slate-200/80 pb-1.5">
										<span className="text-xs font-black uppercase tracking-wider text-slate-700">
											{group.dayName}
										</span>
										<span className="text-xs font-bold text-slate-400">
											({group.dateObj.toLocaleDateString('pl-PL')})
										</span>
										<span className="rounded-full bg-slate-200/70 px-2 py-0.2 text-[10px] font-extrabold text-slate-600">
											{group.items.length} {group.items.length === 1 ? 'grupa' : 'grupy'}
										</span>
									</div>

									{/* KARTY GRUP W TYM DNIU */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{group.items.map((batch) => (
											<div
												key={batch.id}
												onClick={() => onSelectBatch?.(batch)}
												className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all ${
													onSelectBatch ? 'cursor-pointer hover:border-purple-300 hover:shadow-md' : ''
												}`}
											>
												<div className="flex items-start justify-between gap-2">
													<div>
														<h4 className="font-black text-slate-900 text-sm">
															{batch.groupName}
														</h4>
														<div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
															<Building size={12} className="text-slate-400" />
															<span>{batch.branchName}</span>
														</div>
													</div>
													<span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-200">
														<SlashCircle size={10} /> Brak druku
													</span>
												</div>

												{batch.notes && (
													<div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs font-medium text-slate-600 border border-slate-100">
														<span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
															Informacja od trenera
														</span>
														{batch.notes}
													</div>
												)}
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* STOPKA */}
				<div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-white p-4">
					<div className="text-xs text-slate-500 font-medium">
						Łącznie wyświetlono: <strong className="text-slate-800">{filteredBatches.length}</strong> zgłoszeń
					</div>
					<button
						type="button"
						onClick={onClose}
						className="cursor-pointer rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
					>
						Zamknij
					</button>
				</div>
			</div>
		</div>
	);
}
