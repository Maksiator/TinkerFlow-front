import { useState, useEffect, useMemo } from 'react';
import { printBatchService, type PrintBatchResponse, PrintBatchState } from '../api/printBatchService';
import { PrinterFill, ClockHistory, CheckCircleFill, GearFill } from 'react-bootstrap-icons';
import { PrintBatchManagerModal } from '../components/PrintBatchManagerModal';
import toast from 'react-hot-toast';

export function PrinterDashboard() {
	const [batches, setBatches] = useState<PrintBatchResponse[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedBatch, setSelectedBatch] = useState<PrintBatchResponse | null>(null);

	// Dodajemy trigger do ręcznego odświeżania z przycisku
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Filtry i sortowanie
	const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [dateFilter, setDateFilter] = useState<string>('');
	const [sortBy, setSortBy] = useState<'createdAtDesc' | 'createdAtAsc' | 'deadlineAsc'>('createdAtDesc');
	const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
	const [branchSearch, setBranchSearch] = useState('');

	// Zamykanie dropdowna przy kliknięciu poza nim
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('#branch-select-container')) {
				setIsBranchDropdownOpen(false);
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
				const data = await printBatchService.getBatchesForFarm();
				if (isMounted) {
					setBatches(data);
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
	}, [refreshTrigger]);

	// Funkcja wywoływana przez przycisk odświeżania
	const handleRefresh = () => {
		setRefreshTrigger((prev) => prev + 1);
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
			default:
				return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-800">Nieznany</span>;
		}
	};

	const uniqueBranches = useMemo(() => {
		const map = new Map<string, string>();
		batches.forEach((b) => {
			if (b.branchId && b.branchName) {
				map.set(b.branchId, b.branchName);
			}
		});
		return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
	}, [batches]);

	const filteredAndSortedBatches = useMemo(() => {
		let result = [...batches];

		// 1. Filtrowanie statusu
		if (statusFilter !== 'all') {
			result = result.filter((b) => b.status === Number(statusFilter));
		}

		// 2. Filtrowanie szkoły (oddziału) - multi-select
		if (selectedBranchIds.length > 0) {
			result = result.filter((b) => selectedBranchIds.includes(b.branchId));
		}

		// 3. Filtrowanie po dacie lekcji
		if (dateFilter) {
			result = result.filter((b) => {
				const bDate = new Date(b.lessonDate).toISOString().split('T')[0];
				return bDate === dateFilter;
			});
		}

		// 4. Sortowanie
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
	}, [batches, statusFilter, selectedBranchIds, dateFilter, sortBy]);

	if (isLoading && batches.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-10">
				<div className="text-lg font-bold text-slate-400">Ładowanie farmy druku...</div>
			</div>
		);
	}

	return (
		<div className="p-6 md:p-10">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-3 text-3xl font-extrabold text-slate-800">
						<PrinterFill className="text-purple-600" /> Farma Druku
					</h1>
					<p className="mt-2 text-slate-500">Zarządzaj zleceniami spływającymi od trenerów.</p>
				</div>
				<button
					onClick={handleRefresh}
					disabled={isLoading}
					className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
				>
					{isLoading ? 'Odświeżanie...' : 'Odśwież listę'}
				</button>
			</div>

			{/* SEKCA FILTRÓW */}
			<div className="mb-8 flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				{/* CUSTOM SELECT SZKOŁY */}
				<div className="relative flex-1 min-w-[200px]" id="branch-select-container">
					<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Szkoła / Oddział</label>
					<button
						type="button"
						onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
						className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500"
					>
						<span className="truncate">
							{selectedBranchIds.length === 0
								? 'Wszystkie szkoły'
								: selectedBranchIds.length === 1
									? uniqueBranches.find(b => b.id === selectedBranchIds[0])?.name || '1 szkoła'
									: `Wybrano: ${selectedBranchIds.length} szkół`}
						</span>
						<span className="ml-2 text-slate-400 text-[10px]">▼</span>
					</button>

					{isBranchDropdownOpen && (
						<div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
							<input
								type="text"
								placeholder="Szukaj..."
								value={branchSearch}
								onChange={(e) => setBranchSearch(e.target.value)}
								className="mb-2.5 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-purple-500"
							/>
							<div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
								{uniqueBranches
									.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()))
									.map((branch) => {
										const isChecked = selectedBranchIds.includes(branch.id);
										return (
											<label
												key={branch.id}
												className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
											>
												<input
													type="checkbox"
													checked={isChecked}
													onChange={() => {
														setSelectedBranchIds(prev =>
															isChecked
																? prev.filter(id => id !== branch.id)
																: [...prev, branch.id]
														);
													}}
													className="accent-purple-600"
												/>
												<span className="truncate">{branch.name}</span>
											</label>
										);
									})}
								{uniqueBranches.length === 0 && (
									<div className="py-2 text-center text-xs text-slate-400 italic">Brak szkół do wyboru</div>
								)}
							</div>
							{selectedBranchIds.length > 0 && (
								<button
									type="button"
									onClick={() => setSelectedBranchIds([])}
									className="mt-2.5 w-full cursor-pointer rounded-lg bg-slate-100 py-1.5 text-center text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
								>
									Wyczyść zaznaczenie
								</button>
							)}
						</div>
					)}
				</div>

				{/* FILTR STATUSU */}
				<div className="flex-1 min-w-[150px]">
					<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-purple-500"
					>
						<option value="all">Wszystkie</option>
						<option value="0">Oczekujące</option>
						<option value="1">W druku</option>
						<option value="2">Do odbioru</option>
						<option value="3">Zakończone</option>
					</select>
				</div>

				{/* FILTR DATY LEKCJI */}
				<div className="flex-1 min-w-[150px]">
					<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Data lekcji</label>
					<input
						type="date"
						value={dateFilter}
						onChange={(e) => setDateFilter(e.target.value)}
						className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-purple-500"
					/>
				</div>

				{/* SORTOWANIE */}
				<div className="flex-1 min-w-[180px]">
					<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Sortowanie</label>
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as any)}
						className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-purple-500"
					>
						<option value="createdAtDesc">Najnowsze zlecenia</option>
						<option value="createdAtAsc">Najstarsze zlecenia</option>
						<option value="deadlineAsc">Najbliższy termin</option>
					</select>
				</div>

				{/* WYCZYŚĆ FILTRY */}
				{(selectedBranchIds.length > 0 || statusFilter !== 'all' || dateFilter !== '' || sortBy !== 'createdAtDesc') && (
					<div className="flex items-end">
						<button
							onClick={() => {
								setSelectedBranchIds([]);
								setStatusFilter('all');
								setDateFilter('');
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
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{filteredAndSortedBatches.map((batch) => (
						<div
							key={batch.id}
							className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
						>
							{/* Karta paczki - Nagłówek */}
							<div className="border-b border-slate-100 bg-slate-50 p-4">
								<div className="mb-2 flex items-start justify-between">
									<div>
										<span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block">{batch.branchName}</span>
										<h2 className="truncate pr-2 text-lg font-bold text-slate-800" title={batch.groupName}>
											{batch.groupName}
										</h2>
									</div>
									<div className="shrink-0">{getStatusBadge(batch.status)}</div>
								</div>

								<div className="flex flex-col gap-1 text-xs text-slate-500 mt-2">
									<div className="flex items-center gap-1.5 text-slate-700">
										<ClockHistory /> Zlecono:{' '}
										<strong>{new Date(batch.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</strong>
									</div>
									<div className="flex items-center gap-1.5">
										<ClockHistory /> Termin oddania:{' '}
										<strong className="text-red-600">{new Date(batch.deadline).toLocaleDateString()}</strong>
									</div>
									<div className="flex items-center gap-1.5">
										<CheckCircleFill /> Data zajęć:{' '}
										<span className="text-slate-700">{new Date(batch.lessonDate).toLocaleDateString()}</span>
									</div>
								</div>
							</div>

							{/* Karta paczki - Zawartość (Projekty) */}
							<div className="flex-1 p-4">
								<h3 className="mb-3 text-xs font-extrabold tracking-wider text-slate-400 uppercase">
									Zawartość paczki ({batch.printJobs.length})
								</h3>
								<ul className="flex flex-col gap-2">
									{batch.printJobs.map((job) => (
										<li
											key={job.id}
											className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm"
										>
											<span className="truncate font-bold text-slate-700">{job.studentName}</span>
											<span className="shrink-0 rounded border border-purple-100 bg-white px-2 py-1 text-xs font-bold text-purple-700 shadow-sm">
												{job.projectName}
											</span>
										</li>
									))}
								</ul>

								{batch.notes && (
									<div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
										<strong>Notatka od trenera:</strong>
										<p className="mt-1 italic">{batch.notes}</p>
									</div>
								)}
							</div>

							{/* Karta paczki - Stopka */}
							<div className="border-t border-slate-100 bg-slate-50 p-3">
								<button
									onClick={() => setSelectedBatch(batch)} // <-- DODANO onClick
									className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
								>
									<GearFill /> Zarządzaj paczką
								</button>
							</div>
						</div>
					))}
				</div>
			)}
			{/* ---- DODANY MODAL ---- */}
			{selectedBatch && (
				<PrintBatchManagerModal
					batch={selectedBatch}
					isOpen={!!selectedBatch}
					onClose={() => setSelectedBatch(null)}
					onRefreshNeeded={() => {
						// Gdy paczka zmieni status z poziomu modala, musimy odświeżyć główną listę
						setRefreshTrigger((prev) => prev + 1);
					}}
				/>
			)}
		</div>
	);
}
