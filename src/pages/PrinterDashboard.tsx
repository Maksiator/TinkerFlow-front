import { useState, useEffect, useMemo } from 'react';
import { printBatchService, type PrintBatchResponse, PrintBatchState } from '../api/printBatchService';
import { PrinterFill, ClockHistory, GearFill, CalendarEvent, ListTask, Grid3x3GapFill, ChatLeftTextFill, SlashCircle, Scissors } from 'react-bootstrap-icons';
import { PrintBatchManagerModal } from '../components/PrintBatchManagerModal';
import { NoPrintsScheduleModal } from '../components/NoPrintsScheduleModal';
import { CustomSelect } from '../components/CustomSelect';
import { PrintLabelsModal } from '../components/PrintLabelsModal';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import toast from 'react-hot-toast';

export function PrinterDashboard() {
	const currentUser = authService.getCurrentUser();
	const isAdmin = currentUser?.role === UserRole.Admin;

	const [batches, setBatches] = useState<PrintBatchResponse[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedBatch, setSelectedBatch] = useState<PrintBatchResponse | null>(null);
	const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
	const [selectedBatchIdsForLabels, setSelectedBatchIdsForLabels] = useState<string[]>([]);

	// Widok: 'compact' (Tabela / Uproszczony) lub 'detailed' (Karty ze szczegółami)
	const [viewMode, setViewMode] = useState<'compact' | 'detailed'>(() => {
		return (localStorage.getItem('tinkerflow_farm_view_mode') as 'compact' | 'detailed') || 'compact';
	});

	const handleViewModeChange = (mode: 'compact' | 'detailed') => {
		setViewMode(mode);
		localStorage.setItem('tinkerflow_farm_view_mode', mode);
	};

	// Dodajemy trigger do ręcznego odświeżania z przycisku
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Filtry i sortowanie
	const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
	const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
	const [groupSearch, setGroupSearch] = useState('');
	const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>('all');
	const [statusFilter, setStatusFilter] = useState<string>('all');
	
	// Czy pokazywać zakończone (domyślnie false, zapisywane w localStorage)
	const [showCompleted, setShowCompleted] = useState<boolean>(() => {
		return localStorage.getItem('tinkerflow_farm_show_completed') === 'true';
	});

	const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'yesterday' | 'thisWeek' | 'custom'>('all');
	const [customDateValue, setCustomDateValue] = useState<string>('');
	const [sortBy, setSortBy] = useState<'createdAtDesc' | 'createdAtAsc' | 'deadlineAsc'>('createdAtDesc');
	const [isNoPrintsModalOpen, setIsNoPrintsModalOpen] = useState(false);

	// Zamykanie dropdowna przy kliknięciu poza nim
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('#group-select-container')) {
				setIsGroupDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	useEffect(() => {
		let isMounted = true;

		const fetchBatches = async () => {
			setIsLoading(true);
			try {
				const includeCompleted = showCompleted || statusFilter === '3';
				const data = await printBatchService.getBatchesForFarm(undefined, includeCompleted);
				if (isMounted) {
					setBatches(data);
					setSelectedBatch((prev) => (prev ? data.find((b) => b.id === prev.id) || null : null));
				}
			} catch (error: unknown) {
				console.error(error);
				if (isMounted) {
					const errorMessage = error instanceof Error ? error.message : 'Nie udało się pobrać paczek.';
					toast.error(errorMessage);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchBatches();

		return () => {
			isMounted = false;
		};
	}, [refreshTrigger, showCompleted, statusFilter]);

	// Funkcja wywoływana przez przycisk odświeżania
	const handleRefresh = () => {
		setRefreshTrigger((prev) => prev + 1);
	};

	// Natychmiastowa aktualizacja paczki w stanie komponentu (bez czekania na pełny refetch)
	const handleBatchUpdated = (updatedBatch: PrintBatchResponse) => {
		setBatches((prev) => prev.map((b) => (b.id === updatedBatch.id ? updatedBatch : b)));
		setSelectedBatch(updatedBatch);
	};

	// Pomocnicza funkcja do tłumaczenia statusu i przypisania koloru
	const getStatusBadge = (status: PrintBatchState) => {
		switch (status) {
			case PrintBatchState.Pending:
				return (
					<span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">Oczekujące</span>
				);
			case PrintBatchState.Printing:
				return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">W druku</span>;
			case PrintBatchState.ReadyForCollection:
				return (
					<span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">Do odbioru</span>
				);
			case PrintBatchState.Completed:
				return <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Zakończone</span>;
			case PrintBatchState.NoPrints:
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
						<SlashCircle size={11} /> Brak wydruków
					</span>
				);
			default:
				return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-800">Nieznany</span>;
		}
	};

	// Pomocnicza funkcja do tłumaczenia dnia tygodnia
	const getDayName = (day: number | null | undefined) => {
		switch (day) {
			case 1: return 'Poniedziałek';
			case 2: return 'Wtorek';
			case 3: return 'Środa';
			case 4: return 'Czwartek';
			case 5: return 'Piątek';
			case 6: return 'Sobota';
			case 0: return 'Niedziela';
			default: return 'Nieokreślony';
		}
	};



	// Liczba zgłoszeń w bieżącym tygodniu (dla badge'a na przycisku)
	const thisWeekNoPrintsCount = useMemo(() => {
		const baseMonday = new Date();
		const day = baseMonday.getDay();
		const diff = baseMonday.getDate() - day + (day === 0 ? -6 : 1);
		baseMonday.setDate(diff);
		baseMonday.setHours(0, 0, 0, 0);

		const baseSunday = new Date(baseMonday);
		baseSunday.setDate(baseSunday.getDate() + 6);
		baseSunday.setHours(23, 59, 59, 999);

		const mTime = baseMonday.getTime();
		const sTime = baseSunday.getTime();

		return batches.filter((b) => {
			if (b.status !== PrintBatchState.NoPrints) return false;
			const bTime = new Date(b.lessonDate).getTime();
			return bTime >= mTime && bTime <= sTime;
		}).length;
	}, [batches]);

	const uniqueGroups = useMemo(() => {
		const map = new Map<string, { id: string; name: string; branchName: string }>();
		batches.forEach((b) => {
			if (b.groupId && b.groupName) {
				map.set(b.groupId, { id: b.groupId, name: b.groupName, branchName: b.branchName });
			}
		});
		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [batches]);

	const filteredAndSortedBatches = useMemo(() => {
		let result = [...batches];

		// 1. Filtrowanie statusu
		if (statusFilter !== 'all') {
			result = result.filter((b) => b.status === Number(statusFilter));
		} else {
			// Domyślnie w głównej kolejce farmy nie zaśmiecamy widoku pozycjami bez wydruków (widoczne w górnym banerze)
			result = result.filter((b) => b.status !== PrintBatchState.NoPrints);
		}

		// 2. Filtrowanie szkoły / grupy - multi-select
		if (selectedGroupIds.length > 0) {
			result = result.filter((b) => selectedGroupIds.includes(b.groupId));
		}

		// 3. Filtrowanie po dniu tygodnia odbywania się zajęć
		if (dayOfWeekFilter !== 'all') {
			result = result.filter(
				(b) => b.classDayOfWeek !== null && b.classDayOfWeek !== undefined && b.classDayOfWeek === Number(dayOfWeekFilter)
			);
		}

		// 4. Filtrowanie po dacie złożenia zlecenia (CreatedAt)
		if (dateFilterType !== 'all') {
			const todayStr = new Date().toISOString().split('T')[0];

			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayStr = yesterday.toISOString().split('T')[0];

			result = result.filter((b) => {
				const bDate = new Date(b.createdAt).toISOString().split('T')[0];
				
				if (dateFilterType === 'today') {
					return bDate === todayStr;
				} else if (dateFilterType === 'yesterday') {
					return bDate === yesterdayStr;
				} else if (dateFilterType === 'thisWeek') {
					const bTime = new Date(b.createdAt).getTime();
					const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
					return bTime >= sevenDaysAgo;
				} else if (dateFilterType === 'custom' && customDateValue) {
					return bDate === customDateValue;
				}
				return true;
			});
		}

		// 5. Sortowanie
		result.sort((a, b) => {
			if (sortBy === 'createdAtDesc') {
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			} else if (sortBy === 'createdAtAsc') {
				return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			} else if (sortBy === 'deadlineAsc') {
				return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
			}
			return 0;
		});

		return result;
	}, [batches, statusFilter, selectedGroupIds, dayOfWeekFilter, dateFilterType, customDateValue, sortBy]);

	// Paczki spełniające kryteria etykiet (mające wydruki i niebędące NoPrints)
	const eligibleBatchesForLabels = useMemo(() => {
		return filteredAndSortedBatches.filter(
			(b) => b.status !== PrintBatchState.NoPrints && (b.printJobs?.length ?? 0) > 0
		);
	}, [filteredAndSortedBatches]);

	const isAllEligibleSelected =
		eligibleBatchesForLabels.length > 0 &&
		eligibleBatchesForLabels.every((b) => selectedBatchIdsForLabels.includes(b.id));

	const isSomeEligibleSelected =
		!isAllEligibleSelected &&
		eligibleBatchesForLabels.some((b) => selectedBatchIdsForLabels.includes(b.id));

	const toggleSelectAllEligible = () => {
		if (isAllEligibleSelected) {
			setSelectedBatchIdsForLabels([]);
		} else {
			setSelectedBatchIdsForLabels(eligibleBatchesForLabels.map((b) => b.id));
		}
	};

	const toggleBatchSelect = (batchId: string, e?: React.MouseEvent | React.ChangeEvent) => {
		e?.stopPropagation();
		setSelectedBatchIdsForLabels((prev) =>
			prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
		);
	};

	// Statystyki dla aktualnie zaznaczonych paczek do etykiet
	const selectedBatchesForLabels = useMemo(() => {
		return batches.filter((b) => selectedBatchIdsForLabels.includes(b.id));
	}, [batches, selectedBatchIdsForLabels]);

	const selectedBatchesKidsCount = useMemo(() => {
		return new Set(
			selectedBatchesForLabels.flatMap((b) => b.printJobs.map((j) => j.studentName || j.studentId))
		).size;
	}, [selectedBatchesForLabels]);

	const selectedBatchesJobsCount = useMemo(() => {
		return selectedBatchesForLabels.reduce((acc, b) => acc + (b.printJobs?.length || 0), 0);
	}, [selectedBatchesForLabels]);

	if (isLoading && batches.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-10">
				<div className="text-lg font-bold text-slate-400">Ładowanie zleceń druku...</div>
			</div>
		);
	}

	return (
		<div className="p-6 md:p-10">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="flex flex-wrap items-center gap-3 text-3xl font-extrabold text-slate-800">
						<span className="flex items-center gap-3">
							<PrinterFill className="text-purple-600" /> Panel Drukarza
						</span>
						{isAdmin ? (
							<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
								Widok Master (Wszystkie paczki)
							</span>
						) : currentUser?.role === UserRole.Coordinator ? (
							<span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200">
								Widok Koordynatora (Twój oddział)
							</span>
						) : currentUser?.role === UserRole.Trainer ? (
							<span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 border border-indigo-200">
								Widok Trenera (Własne grupy)
							</span>
						) : null}
					</h1>
					<p className="mt-2 text-slate-500">
						{isAdmin
							? 'Jako administrator masz pełny wgląd do wszystkich paczek wydruków ze wszystkich grup i oddziałów.'
							: currentUser?.role === UserRole.Coordinator
							? 'Jako koordynator masz wgląd do wszystkich zleceń druku z przypisanych do Ciebie oddziałów.'
							: currentUser?.role === UserRole.Trainer
							? 'Przeglądaj i zarządzaj zleceniami druku dla swoich grup.'
							: 'Zarządzaj zleceniami druku spływającymi z przypisanych do Ciebie grup.'}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					{/* PRZEŁĄCZNIK WIDOKÓW */}
					<div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
						<button
							onClick={() => handleViewModeChange('compact')}
							className={`flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
								viewMode === 'compact'
									? 'bg-white text-purple-700 shadow-sm'
									: 'text-slate-600 hover:text-slate-900'
							}`}
							title="Widok kompaktowy (Tabela) - szybki przegląd bez przewijania"
						>
							<ListTask size={16} /> Tabela
						</button>
						<button
							onClick={() => handleViewModeChange('detailed')}
							className={`flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
								viewMode === 'detailed'
									? 'bg-white text-purple-700 shadow-sm'
									: 'text-slate-600 hover:text-slate-900'
							}`}
							title="Widok szczegółowy (Karty) - z pełną zawartością paczki"
						>
							<Grid3x3GapFill size={14} /> Karty
						</button>
					</div>

					{/* PRZYCISK HARMONOGRAMU INNYCH TECHNOLOGII */}
					<button
						type="button"
						onClick={() => setIsNoPrintsModalOpen(true)}
						className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
						title="Otwórz harmonogram grup bez wydruków (inna technologia)"
					>
						<SlashCircle className="text-amber-600" size={15} />
						<span>Inna technologia</span>
						{thisWeekNoPrintsCount > 0 && (
							<span className="rounded-full bg-amber-100 px-2 py-0.2 text-xs font-black text-amber-800 border border-amber-200">
								{thisWeekNoPrintsCount}
							</span>
						)}
					</button>

					{/* PRZYCISK DRUKOWANIA ETYKIET A4 (ADMIN ONLY) */}
					{isAdmin && (
						<button
							type="button"
							onClick={() => setIsLabelsModalOpen(true)}
							className="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-sm font-bold text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-100"
							title="Otwórz generator etykiet na woreczki A4 (dla grup lub własnych warsztatów)"
						>
							<Scissors className="text-purple-600" size={15} />
							<span>Etykiety A4</span>
							{selectedBatchIdsForLabels.length > 0 && (
								<span className="rounded-full bg-purple-200 px-2 py-0.2 text-xs font-black text-purple-900">
									{selectedBatchIdsForLabels.length}
								</span>
							)}
						</button>
					)}


					<label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50">
						<input
							type="checkbox"
							checked={showCompleted}
							onChange={(e) => {
								const val = e.target.checked;
								setShowCompleted(val);
								localStorage.setItem('tinkerflow_farm_show_completed', String(val));
							}}
							className="h-4 w-4 rounded border-slate-300 text-purple-600 accent-purple-600 focus:ring-purple-500"
						/>
						Zakończone
					</label>
					<button
						onClick={handleRefresh}
						disabled={isLoading}
						className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
					>
						{isLoading ? 'Odświeżanie...' : 'Odśwież listę'}
					</button>
				</div>
			</div>

			{/* SEKCA FILTRÓW */}
			<div className="mb-8 flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				{/* CUSTOM SELECT SZKOŁY / GRUPY */}
				<div className="relative flex-1 min-w-[220px]" id="group-select-container">
					<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Szkoła / Grupa</label>
					<button
						type="button"
						onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
						className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500"
					>
						<span className="truncate">
							{selectedGroupIds.length === 0
								? 'Wszystkie szkoły / grupy'
								: selectedGroupIds.length === 1
									? uniqueGroups.find(g => g.id === selectedGroupIds[0])?.name || '1 grupa'
									: `Wybrano: ${selectedGroupIds.length} grup`}
						</span>
						<span className="ml-2 text-slate-400 text-[10px]">▼</span>
					</button>

					{isGroupDropdownOpen && (
						<div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
							<input
								type="text"
								placeholder="Szukaj grupy / szkoły..."
								value={groupSearch}
								onChange={(e) => setGroupSearch(e.target.value)}
								className="mb-2.5 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-purple-500"
							/>
							<div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
								{uniqueGroups
									.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()) || g.branchName.toLowerCase().includes(groupSearch.toLowerCase()))
									.map((group) => {
										const isChecked = selectedGroupIds.includes(group.id);
										return (
											<label
												key={group.id}
												className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
											>
												<input
													type="checkbox"
													checked={isChecked}
													onChange={() => {
														setSelectedGroupIds(prev =>
															isChecked
																? prev.filter(id => id !== group.id)
																: [...prev, group.id]
														);
													}}
													className="accent-purple-600"
												/>
												<span className="truncate font-bold">{group.name}</span>
												<span className="text-[10px] text-slate-400">({group.branchName})</span>
											</label>
										);
									})}
								{uniqueGroups.length === 0 && (
									<div className="py-2 text-center text-xs text-slate-400 italic">Brak grup w zleceniach</div>
								)}
							</div>
							{selectedGroupIds.length > 0 && (
								<button
									type="button"
									onClick={() => setSelectedGroupIds([])}
									className="mt-2.5 w-full cursor-pointer rounded-lg bg-slate-100 py-1.5 text-center text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
								>
									Wyczyść zaznaczenie ({selectedGroupIds.length})
								</button>
							)}
						</div>
					)}
				</div>

				{/* FILTR DNIA TYGODNIA ZAJĘĆ */}
				<CustomSelect
					label="Dzień zajęć"
					value={dayOfWeekFilter}
					onChange={setDayOfWeekFilter}
					options={[
						{ value: 'all', label: 'Wszystkie dni' },
						{ value: '1', label: 'Poniedziałek' },
						{ value: '2', label: 'Wtorek' },
						{ value: '3', label: 'Środa' },
						{ value: '4', label: 'Czwartek' },
						{ value: '5', label: 'Piątek' },
						{ value: '6', label: 'Sobota' },
						{ value: '0', label: 'Niedziela' },
					]}
					className="flex-1 min-w-[150px]"
				/>

				{/* FILTR STATUSU */}
				<CustomSelect
					label="Status"
					value={statusFilter}
					onChange={setStatusFilter}
					options={[
						{ value: 'all', label: 'Wszystkie zlecenia druku' },
						{ value: '0', label: 'Oczekujące' },
						{ value: '1', label: 'W druku' },
						{ value: '2', label: 'Do odbioru' },
						{ value: '3', label: 'Zakończone' },
						{ value: '4', label: 'Inna technologia (brak wydruków)' },
					]}
					className="flex-1 min-w-[150px]"
				/>

				{/* FILTR DATY ZŁOŻENIA */}
				<CustomSelect
					label="Złożono zlecenia"
					value={dateFilterType}
					onChange={(val) => setDateFilterType(val as any)}
					options={[
						{ value: 'all', label: 'Wszystkie daty' },
						{ value: 'today', label: 'Dzisiaj' },
						{ value: 'yesterday', label: 'Wczoraj' },
						{ value: 'thisWeek', label: 'Ostatnie 7 dni' },
						{ value: 'custom', label: 'Wybrany dzień...' },
					]}
					className="flex-1 min-w-[150px]"
				/>

				{/* INNA DATA (OPCJONALNIE) */}
				{dateFilterType === 'custom' && (
					<div className="flex-1 min-w-[150px] animate-in fade-in slide-in-from-left-2 duration-200">
						<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Wybierz dzień</label>
						<input
							type="date"
							value={customDateValue}
							onChange={(e) => setCustomDateValue(e.target.value)}
							className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-purple-500"
						/>
					</div>
				)}

				{/* SORTOWANIE */}
				<CustomSelect
					label="Sortowanie"
					value={sortBy}
					onChange={(val) => setSortBy(val as any)}
					options={[
						{ value: 'createdAtDesc', label: 'Najnowsze zlecenia' },
						{ value: 'createdAtAsc', label: 'Najstarsze zlecenia' },
						{ value: 'deadlineAsc', label: 'Najbliższy termin' },
					]}
					className="flex-1 min-w-[180px]"
				/>

				{/* WYCZYŚĆ FILTRY */}
				{(selectedGroupIds.length > 0 || dayOfWeekFilter !== 'all' || statusFilter !== 'all' || dateFilterType !== 'all' || sortBy !== 'createdAtDesc') && (
					<div className="flex items-end">
						<button
							onClick={() => {
								setSelectedGroupIds([]);
								setDayOfWeekFilter('all');
								setStatusFilter('all');
								setDateFilterType('all');
								setCustomDateValue('');
								setSortBy('createdAtDesc');
							}}
							className="h-[46px] cursor-pointer rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200"
						>
							Wyczyść filtry
						</button>
					</div>
				)}
			</div>

			{filteredAndSortedBatches.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
					<p className="text-lg font-bold text-slate-500">Brak aktywnych zleceń druku spełniających kryteria.</p>
					<p className="text-sm text-slate-400">Spróbuj zmienić parametry filtrów lub odświeżyć listę.</p>
				</div>
			) : viewMode === 'compact' ? (
				/* WIDOK KOMPAKTOWY (TABELA) */
				<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-left text-sm">
							<thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold text-xs uppercase tracking-wider">
								<tr>
									{isAdmin && (
										<th className="p-4 w-10 text-center">
											<input
												type="checkbox"
												checked={isAllEligibleSelected}
												ref={(el) => {
													if (el) el.indeterminate = isSomeEligibleSelected;
												}}
												onChange={toggleSelectAllEligible}
												className="h-4 w-4 rounded border-slate-300 text-purple-600 accent-purple-600 cursor-pointer"
												title="Zaznacz/odznacz wszystkie widoczne paczki z wydrukami"
											/>
										</th>
									)}
									<th className="p-4">Status</th>
									<th className="p-4">Szkoła / Grupa</th>
									<th className="p-4">Dzień zajęć</th>
									<th className="p-4 text-center">Zawartość</th>
									<th className="p-4">Złożono</th>
									<th className="p-4">Termin oddania</th>
									{isAdmin && <th className="p-4">Drukarz</th>}
									<th className="p-4 text-center">Notatka</th>
									<th className="p-4 text-right">Akcja</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{filteredAndSortedBatches.map((batch) => {
									const uniqueStudentsCount = new Set(batch.printJobs.map((j) => j.studentId)).size;
									const isDeadlineSoon = new Date(batch.deadline).getTime() - Date.now() < 24 * 60 * 60 * 1000;
									const isEligibleForLabels = batch.status !== PrintBatchState.NoPrints && (batch.printJobs?.length ?? 0) > 0;
									const isSelectedForLabels = selectedBatchIdsForLabels.includes(batch.id);

									return (
										<tr
											key={batch.id}
											onClick={() => setSelectedBatch(batch)}
											className={`cursor-pointer transition-colors ${
												isSelectedForLabels ? 'bg-purple-50/80 hover:bg-purple-100/70' : 'hover:bg-purple-50/50'
											}`}
										>
											{isAdmin && (
												<td className="p-4 w-10 text-center" onClick={(e) => e.stopPropagation()}>
													{isEligibleForLabels ? (
														<input
															type="checkbox"
															checked={isSelectedForLabels}
															onChange={(e) => toggleBatchSelect(batch.id, e)}
															className="h-4 w-4 rounded border-slate-300 text-purple-600 accent-purple-600 cursor-pointer"
															title="Zaznacz paczkę do druku etykiet"
														/>
													) : (
														<span className="text-slate-200 text-xs">—</span>
													)}
												</td>
											)}
											<td className="p-4 whitespace-nowrap">
												{getStatusBadge(batch.status)}
											</td>
											<td className="p-4">
												<div className="font-bold text-slate-800">{batch.groupName}</div>
												<div className="text-xs font-semibold text-purple-600">{batch.branchName}</div>
											</td>
											<td className="p-4 whitespace-nowrap">
												<span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
													<CalendarEvent size={12} /> {getDayName(batch.classDayOfWeek)}
												</span>
											</td>
											<td className="p-4 text-center whitespace-nowrap">
												{batch.status === PrintBatchState.NoPrints ? (
													<span className="text-xs font-bold text-slate-400 italic">0 (Brak)</span>
												) : (
													<div className="inline-flex flex-col items-center">
														<span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
															{batch.printJobs.length} {batch.printJobs.length === 1 ? 'model' : 'modeli'}
														</span>
														<span className="text-[10px] text-slate-400 font-medium mt-0.5">
															{uniqueStudentsCount} {uniqueStudentsCount === 1 ? 'uczeń' : 'uczniów'}
														</span>
													</div>
												)}
											</td>
											<td className="p-4 whitespace-nowrap text-xs text-slate-600">
												<div className="font-semibold text-slate-700">
													{new Date(batch.createdAt).toLocaleDateString('pl-PL')}
												</div>
												<div className="text-[10px] text-slate-400">
													{new Date(batch.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
												</div>
											</td>
											<td className="p-4 whitespace-nowrap text-xs">
												{batch.status === PrintBatchState.NoPrints ? (
													<span className="text-slate-400 font-medium">—</span>
												) : (
													<span
														className={`font-bold px-2 py-1 rounded-md border ${
															isDeadlineSoon
																? 'text-red-700 bg-red-50 border-red-200'
																: 'text-slate-700 bg-slate-50 border-slate-200'
														}`}
													>
														{new Date(batch.deadline).toLocaleDateString('pl-PL')}
													</span>
												)}
											</td>
											{isAdmin && (
												<td className="p-4 whitespace-nowrap text-xs">
													{batch.assignedPrinterName ? (
														<span className="font-semibold text-purple-700">
															{batch.assignedPrinterName}
														</span>
													) : (
														<span className="italic text-slate-400">Brak</span>
													)}
												</td>
											)}
											<td className="p-4 text-center whitespace-nowrap">
												<div className="flex items-center justify-center gap-1.5">
													{batch.notes && (
														<span
															className="inline-flex items-center justify-center rounded-lg bg-yellow-100 p-1.5 text-yellow-800 hover:bg-yellow-200 transition-colors"
															title={`Notatka trenera:\n${batch.notes}`}
														>
															<ChatLeftTextFill size={14} />
														</span>
													)}
													{batch.printerNotes && (
														<span
															className="inline-flex items-center justify-center rounded-lg bg-indigo-100 p-1.5 text-indigo-800 hover:bg-indigo-200 transition-colors"
															title={`Twoja informacja dla trenera:\n${batch.printerNotes}`}
														>
															<ChatLeftTextFill size={14} />
														</span>
													)}
													{!batch.notes && !batch.printerNotes && (
														<span className="text-slate-300 text-xs">—</span>
													)}
												</div>
											</td>
											<td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
												<div className="inline-flex items-center gap-1.5">
													{isAdmin && batch.status !== PrintBatchState.NoPrints && (
														<button
															type="button"
															onClick={() => {
																setSelectedBatchIdsForLabels([batch.id]);
																setIsLabelsModalOpen(true);
															}}
															className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-100"
															title="Drukuj etykiety do woreczków (Tylko Admin)"
														>
															<Scissors size={13} />
															Etykiety
														</button>
													)}
													<button
														onClick={() => setSelectedBatch(batch)}
														className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shadow-xs transition-colors ${
															batch.status === PrintBatchState.NoPrints
																? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
																: 'bg-purple-600 text-white hover:bg-purple-700'
														}`}
													>
														{batch.status === PrintBatchState.NoPrints ? (
															<>
																<SlashCircle size={12} /> Szczegóły
															</>
														) : (
															<>
																<GearFill size={12} /> Zarządzaj
															</>
														)}
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			) : (
				/* WIDOK SZCZEGÓŁOWY (KARTY) */
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{filteredAndSortedBatches.map((batch) => {
						const isEligibleForLabels = batch.status !== PrintBatchState.NoPrints && (batch.printJobs?.length ?? 0) > 0;
						const isSelectedForLabels = selectedBatchIdsForLabels.includes(batch.id);

						return (
							<div
								key={batch.id}
								className={`flex flex-col overflow-hidden rounded-xl border transition-all ${
									isSelectedForLabels
										? 'border-purple-500 ring-2 ring-purple-400 bg-purple-50/20 shadow-md'
										: 'border-slate-200 bg-white shadow-sm hover:shadow-md'
								}`}
							>
								{/* Karta paczki - Nagłówek */}
								<div className="border-b border-slate-100 bg-slate-50 p-4">
									<div className="mb-2 flex items-start justify-between gap-3">
										<div className="flex items-start gap-2.5 min-w-0">
											{isAdmin && isEligibleForLabels && (
												<div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
													<input
														type="checkbox"
														checked={isSelectedForLabels}
														onChange={(e) => toggleBatchSelect(batch.id, e)}
														className="h-4 w-4 rounded border-slate-300 text-purple-600 accent-purple-600 cursor-pointer"
														title="Zaznacz paczkę do druku etykiet"
													/>
												</div>
											)}
											<div className="min-w-0">
												<span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block truncate">{batch.branchName}</span>
												<h2 className="truncate pr-2 text-lg font-bold text-slate-800" title={batch.groupName}>
													{batch.groupName}
												</h2>
											</div>
										</div>
										<div className="shrink-0">{getStatusBadge(batch.status)}</div>
									</div>

								<div className="flex flex-col gap-1 text-xs text-slate-500 mt-2">
									<div className="flex items-center gap-1.5 font-semibold text-slate-800">
										<CalendarEvent className="text-blue-600" /> Dzień zajęć: {getDayName(batch.classDayOfWeek)}
									</div>
									<div className="flex items-center gap-1.5 text-slate-700">
										<ClockHistory /> Złożono:{' '}
										<strong>{new Date(batch.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</strong>
									</div>
									<div className="flex items-center gap-1.5">
										<ClockHistory /> Termin oddania:{' '}
										<strong className="text-red-600">{new Date(batch.deadline).toLocaleDateString()}</strong>
									</div>
									<div className="flex items-center gap-1.5 pt-1">
										<PrinterFill className={batch.assignedPrinterName ? "text-purple-600" : "text-slate-400"} />
										{batch.assignedPrinterName ? (
											<span className="font-semibold text-purple-700">
												Drukarz: {batch.assignedPrinterName}
											</span>
										) : (
											<span className="italic text-slate-400">
												Drukarz: Brak przypisania
											</span>
										)}
									</div>
								</div>
							</div>

							{/* Karta paczki - Zawartość (Projekty) */}
							<div className="flex-1 p-4">
								{batch.status === PrintBatchState.NoPrints ? (
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
										<SlashCircle className="mx-auto mb-2 text-slate-400" size={20} />
										<p className="text-xs font-bold text-slate-700">Brak modeli do druku</p>
										<p className="text-[11px] text-slate-500 mt-0.5">
											Trener zgłosił brak wydruków na tych zajęciach.
										</p>
										{batch.notes && (
											<div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800">
												Powód: {batch.notes}
											</div>
										)}
									</div>
								) : (
									<>
										<h3 className="mb-3 text-xs font-extrabold tracking-wider text-slate-400 uppercase">
											Zawartość paczki ({batch.printJobs.length})
										</h3>
										
										{(() => {
											const groupedJobs = batch.printJobs.reduce(
												(acc, job) => {
													if (!acc[job.studentName]) acc[job.studentName] = [];
													acc[job.studentName].push(job.projectName);
													return acc;
												},
												{} as Record<string, string[]>,
											);

											return (
												<div className="flex flex-col gap-2.5">
													{Object.entries(groupedJobs).map(([studentName, projectNames]) => (
														<div
															key={studentName}
															className="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-sm"
														>
															<span className="mb-1.5 font-bold text-slate-700">{studentName}</span>
															<div className="flex flex-wrap gap-1">
																{projectNames.map((proj, idx) => (
																	<span
																		key={idx}
																		className="rounded border border-purple-100 bg-white px-2 py-0.5 text-xs font-bold text-purple-700 shadow-sm"
																	>
																		{proj}
																	</span>
																))}
															</div>
														</div>
													))}
												</div>
											);
										})()}

										{batch.notes && (
											<div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
												<strong>Notatka od trenera:</strong>
												<p className="mt-1 italic">{batch.notes}</p>
											</div>
										)}

										{batch.printerNotes && (
											<div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-sm text-indigo-900">
												<strong>Twoja informacja dla trenera:</strong>
												<p className="mt-1 text-slate-700">{batch.printerNotes}</p>
											</div>
										)}
									</>
								)}
							</div>

							{/* Karta paczki - Stopka */}
							<div className="border-t border-slate-100 bg-slate-50 p-3 flex items-center gap-2">
								{isAdmin && batch.status !== PrintBatchState.NoPrints && (
									<button
										type="button"
										onClick={() => {
											setSelectedBatchIdsForLabels([batch.id]);
											setIsLabelsModalOpen(true);
										}}
										className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 py-2.5 px-3 text-sm font-bold text-purple-700 transition-colors hover:bg-purple-100"
										title="Drukuj etykiety do woreczków (Tylko Admin)"
									>
										<Scissors size={15} /> Etykiety
									</button>
								)}
								<button
									onClick={() => setSelectedBatch(batch)}
									className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold shadow-xs transition-colors ${
										batch.status === PrintBatchState.NoPrints
											? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
											: 'bg-purple-600 text-white hover:bg-purple-700'
									}`}
								>
									{batch.status === PrintBatchState.NoPrints ? (
										<>
											<SlashCircle /> Szczegóły zgłoszenia
										</>
									) : (
										<>
											<GearFill /> Zarządzaj paczką
										</>
									)}
								</button>
							</div>
						</div>
					);
				})}
				</div>
			)}

			{/* PŁYWAJĄCY PASEK AKCJI MASOWEGO DRUKOWANIA ETYKIET (TYLKO DLA ADMINA) */}
			{isAdmin && selectedBatchIdsForLabels.length > 0 && (
				<div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-purple-200 bg-white/95 px-5 py-3 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-5">
					<div className="flex items-center gap-3">
						<span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-xs font-black text-white shadow-xs">
							{selectedBatchIdsForLabels.length}
						</span>
						<div className="text-xs">
							<div className="font-extrabold text-slate-800">
								{selectedBatchIdsForLabels.length === 1
									? '1 wybrana grupa do etykiet'
									: `${selectedBatchIdsForLabels.length} wybrane grupy do etykiet`}
							</div>
							<div className="text-[11px] font-medium text-slate-500">
								{selectedBatchesKidsCount} {selectedBatchesKidsCount === 1 ? 'uczeń' : 'uczniów'} • {selectedBatchesJobsCount} {selectedBatchesJobsCount === 1 ? 'model' : 'modeli'}
							</div>
						</div>
					</div>

					<div className="h-7 w-px bg-slate-200" />

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setIsLabelsModalOpen(true)}
							className="flex cursor-pointer items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white shadow-md transition-all hover:bg-purple-700 active:scale-95"
						>
							<Scissors size={15} />
							Drukuj etykiety A4 (Bulk)
						</button>
						<button
							type="button"
							onClick={() => setSelectedBatchIdsForLabels([])}
							className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
						>
							Odznacz
						</button>
					</div>
				</div>
			)}
			{/* ---- DODANY MODAL ---- */}
			{selectedBatch && (
				<PrintBatchManagerModal
					batch={selectedBatch}
					isOpen={!!selectedBatch}
					onClose={() => setSelectedBatch(null)}
					onBatchUpdated={handleBatchUpdated}
					onRefreshNeeded={() => {
						// Gdy paczka zmieni status z poziomu modala, musimy odświeżyć główną listę
						setRefreshTrigger((prev) => prev + 1);
					}}
				/>
			)}

			{/* MODAL HARMONOGRAMU INNYCH TECHNOLOGII */}
			<NoPrintsScheduleModal
				isOpen={isNoPrintsModalOpen}
				onClose={() => setIsNoPrintsModalOpen(false)}
				batches={batches}
				onSelectBatch={(batch) => {
					setIsNoPrintsModalOpen(false);
					setSelectedBatch(batch);
				}}
			/>

			{/* MODAL DRUKOWANIA ETYKIET DO WORECZKÓW (TYLKO DLA ADMINA) */}
			{isAdmin && isLabelsModalOpen && (
				<PrintLabelsModal
					isOpen={isLabelsModalOpen}
					onClose={() => setIsLabelsModalOpen(false)}
					allBatches={batches}
					selectedBatchIds={selectedBatchIdsForLabels}
					onBatchIdsChange={setSelectedBatchIdsForLabels}
				/>
			)}
		</div>
	);
}
