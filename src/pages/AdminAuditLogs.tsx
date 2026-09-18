import { useState, useEffect, useCallback } from 'react';
import {
	JournalText,
	Search,
	ArrowClockwise,
	Trash,
	ShieldLockFill,
	PersonBadgeFill,
	PeopleFill,
	PersonVcardFill,
	PrinterFill,
	InfoCircleFill,
	XLg,
	FunnelFill,
	CheckCircleFill,
	XCircleFill,
	BoxArrowInRight,
	KeyFill,
} from 'react-bootstrap-icons';
import {
	auditLogService,
	type AuditLogItem,
	type AuditLogFiltersResponse,
} from '../api/auditLogService';
import toast from 'react-hot-toast';

export function AdminAuditLogs() {
	const [logs, setLogs] = useState<AuditLogItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [totalPages, setTotalPages] = useState(1);

	// Filters
	const [search, setSearch] = useState('');
	const [category, setCategory] = useState('');
	const [actionName, setActionName] = useState('');
	const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days'>('all');
	const [availableFilters, setAvailableFilters] = useState<AuditLogFiltersResponse>({
		categories: [],
		actions: [],
	});

	// Modals
	const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
	const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
	const [cleanupDays, setCleanupDays] = useState(90);
	const [isCleaning, setIsCleaning] = useState(false);

	// Compute date ranges based on datePreset
	const getDateRange = useCallback(() => {
		const now = new Date();
		if (datePreset === 'today') {
			const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
			return { fromDate: startOfDay.toISOString(), toDate: now.toISOString() };
		}
		if (datePreset === '7days') {
			const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			return { fromDate: sevenDaysAgo.toISOString(), toDate: now.toISOString() };
		}
		if (datePreset === '30days') {
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			return { fromDate: thirtyDaysAgo.toISOString(), toDate: now.toISOString() };
		}
		return { fromDate: undefined, toDate: undefined };
	}, [datePreset]);

	// Fetch filters once
	useEffect(() => {
		let isMounted = true;
		const loadFilters = async () => {
			try {
				const data = await auditLogService.getFilters();
				if (isMounted) {
					setAvailableFilters(data);
				}
			} catch (err) {
				console.error('Błąd pobierania filtrów logów', err);
			}
		};
		loadFilters();
		return () => {
			isMounted = false;
		};
	}, []);

	// Fetch logs
	const fetchLogs = useCallback(async () => {
		setIsLoading(true);
		try {
			const { fromDate, toDate } = getDateRange();
			const res = await auditLogService.getLogs({
				page,
				pageSize,
				search: search.trim() || undefined,
				category: category || undefined,
				actionName: actionName || undefined,
				fromDate,
				toDate,
			});
			setLogs(res.items);
			setTotalCount(res.totalCount);
			setTotalPages(res.totalPages);
		} catch (err) {
			console.error('Błąd pobierania logów', err);
			toast.error('Nie udało się załadować dziennika zdarzeń.');
		} finally {
			setIsLoading(false);
		}
	}, [page, pageSize, search, category, actionName, getDateRange]);

	useEffect(() => {
		fetchLogs();
	}, [fetchLogs]);

	// Reset page to 1 when filters change
	const handleFilterChange = (setter: (val: any) => void, val: any) => {
		setter(val);
		setPage(1);
	};

	const handleCleanup = async () => {
		if (cleanupDays < 14) {
			toast.error('Minimalny okres retencji to 14 dni.');
			return;
		}
		setIsCleaning(true);
		try {
			const res = await auditLogService.cleanupOldLogs(cleanupDays);
			toast.success(res.message);
			setIsCleanupModalOpen(false);
			fetchLogs();
		} catch (err) {
			console.error('Błąd czyszczenia logów', err);
			toast.error('Błąd podczas usuwania starych logów.');
		} finally {
			setIsCleaning(false);
		}
	};

	// Pretty formatting helpers
	const getCategoryBadge = (cat: string) => {
		switch (cat.toLowerCase()) {
			case 'auth':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
						<KeyFill size={12} /> Autoryzacja
					</span>
				);
			case 'users':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
						<PersonBadgeFill size={12} /> Personel
					</span>
				);
			case 'groups':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
						<PeopleFill size={12} /> Grupy
					</span>
				);
			case 'students':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
						<PersonVcardFill size={12} /> Uczniowie
					</span>
				);
			case 'printbatches':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
						<PrinterFill size={12} /> Panel Drukarza
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
						{cat}
					</span>
				);
		}
	};

	const getActionLabel = (act: string) => {
		const map: Record<string, { label: string; icon?: React.ReactNode; colorClass?: string }> = {
			LoginSuccess: { label: 'Logowanie (Sukces)', icon: <BoxArrowInRight size={14} className="text-emerald-500" /> },
			LoginFailed: { label: 'Błędne hasło / email', icon: <XCircleFill size={14} className="text-rose-500" /> },
			LoginBlocked: { label: 'Blokada konta', icon: <ShieldLockFill size={14} className="text-red-600" /> },
			CreateUser: { label: 'Utworzenie konta', icon: <CheckCircleFill size={14} className="text-blue-500" /> },
			UpdateUser: { label: 'Edycja użytkownika', icon: <InfoCircleFill size={14} className="text-blue-400" /> },
			ToggleStatus: { label: 'Zmiana statusu konta' },
			DeleteUser: { label: 'Usunięcie konta', icon: <XCircleFill size={14} className="text-rose-500" /> },
			PasswordChanged: { label: 'Zmiana hasła' },
			ResetPassword: { label: 'Reset hasła' },
			CreateGroup: { label: 'Utworzenie grupy' },
			UpdateGroup: { label: 'Edycja grupy' },
			DeleteGroup: { label: 'Usunięcie grupy' },
			BulkDeleteGroups: { label: 'Masowe usunięcie grup' },
			BulkChangeBranch: { label: 'Masowa zmiana oddziału' },
			BulkAssignPrinter: { label: 'Masowe przypisanie drukarza' },
			ArchiveGroup: { label: 'Archiwizacja grupy' },
			CreateStudent: { label: 'Dodanie ucznia' },
			UpdateStudent: { label: 'Edycja ucznia' },
			DeleteStudent: { label: 'Usunięcie ucznia' },
			BulkDeleteStudents: { label: 'Masowe usunięcie uczniów' },
			BulkChangeGroup: { label: 'Masowe przeniesienie uczniów' },
			ImportStudents: { label: 'Import uczniów' },
			SendToFarm: { label: 'Wysłanie paczki do drukarza' },
			UpdateBatchStatus: { label: 'Zmiana statusu paczki' },
			DeleteBatch: { label: 'Usunięcie paczki' },
		};

		const item = map[act];
		if (!item) return <span className="font-mono text-xs text-slate-700">{act}</span>;
		return (
			<span className="inline-flex items-center gap-1.5 font-medium text-slate-800 text-xs sm:text-sm">
				{item.icon}
				{item.label}
			</span>
		);
	};

	const formatDate = (isoString: string) => {
		try {
			const d = new Date(isoString);
			return d.toLocaleString('pl-PL', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
			});
		} catch {
			return isoString;
		}
	};

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			{/* NAGŁÓWEK */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
						<JournalText size={28} />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-2xl font-black text-slate-900 tracking-tight">Dziennik Zdarzeń (Audit Log)</h1>
							<span className="px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
								{totalCount} wpisów
							</span>
						</div>
						<p className="text-sm text-slate-500 font-medium">
							Rejestr operacji w systemie, zmian danych oraz zdarzeń bezpieczeństwa (dostępny tylko dla Administratora).
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 self-start md:self-auto">
					<button
						onClick={() => fetchLogs()}
						disabled={isLoading}
						className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all disabled:opacity-50 cursor-pointer"
						title="Odśwież wpisy"
					>
						<ArrowClockwise className={isLoading ? 'animate-spin' : ''} size={16} />
						<span>Odśwież</span>
					</button>

					<button
						onClick={() => setIsCleanupModalOpen(true)}
						className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm rounded-xl transition-all cursor-pointer border border-rose-200"
						title="Usuń stare logi"
					>
						<Trash size={16} />
						<span className="hidden sm:inline">Czyszczenie logów</span>
					</button>
				</div>
			</div>

			{/* FILTRY */}
			<div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
				<div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
					<FunnelFill size={14} className="text-blue-500" />
					<span>Filtrowanie zdarzeń</span>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
					{/* Szukajka tekstowa */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
						<input
							type="text"
							placeholder="Szukaj (email, obiekt, szczegóły)..."
							value={search}
							onChange={(e) => handleFilterChange(setSearch, e.target.value)}
							className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
						/>
					</div>

					{/* Kategoria */}
					<div>
						<select
							value={category}
							onChange={(e) => handleFilterChange(setCategory, e.target.value)}
							className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-700 cursor-pointer"
						>
							<option value="">Wszystkie kategorie</option>
							{availableFilters.categories.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</div>

					{/* Akcja */}
					<div>
						<select
							value={actionName}
							onChange={(e) => handleFilterChange(setActionName, e.target.value)}
							className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-700 cursor-pointer"
						>
							<option value="">Wszystkie akcje</option>
							{availableFilters.actions.map((a) => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
					</div>

					{/* Zakres dat */}
					<div>
						<select
							value={datePreset}
							onChange={(e) => handleFilterChange(setDatePreset, e.target.value as any)}
							className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-700 cursor-pointer"
						>
							<option value="all">Cały okres</option>
							<option value="today">Dzisiaj</option>
							<option value="7days">Ostatnie 7 dni</option>
							<option value="30days">Ostatnie 30 dni</option>
						</select>
					</div>
				</div>
			</div>

			{/* TABELA Z LOGAMI */}
			<div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse">
						<thead>
							<tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
								<th className="py-3 px-4">Data i czas</th>
								<th className="py-3 px-4">Kategoria</th>
								<th className="py-3 px-4">Zdarzenie</th>
								<th className="py-3 px-4">Wykonawca</th>
								<th className="py-3 px-4">Obiekt docelowy</th>
								<th className="py-3 px-4">Szczegóły</th>
								<th className="py-3 px-4">IP</th>
								<th className="py-3 px-4 text-right">Więcej</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 text-sm">
							{isLoading ? (
								<tr>
									<td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
										<div className="flex flex-col items-center justify-center gap-2">
											<ArrowClockwise className="animate-spin text-blue-500" size={24} />
											<span>Ładowanie rejestru zdarzeń...</span>
										</div>
									</td>
								</tr>
							) : logs.length === 0 ? (
								<tr>
									<td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
										<div className="flex flex-col items-center justify-center gap-2">
											<JournalText size={32} className="text-slate-300" />
											<span className="text-base font-bold text-slate-600">Brak zarejestrowanych zdarzeń</span>
											<span className="text-xs text-slate-400">
												Zmień kryteria wyszukiwania lub filtry, aby wyświetlić wpisy.
											</span>
										</div>
									</td>
								</tr>
							) : (
								logs.map((log) => (
									<tr
										key={log.id}
										onClick={() => setSelectedLog(log)}
										className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
									>
										{/* Data */}
										<td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
											{formatDate(log.timestamp)}
										</td>

										{/* Kategoria */}
										<td className="py-3.5 px-4 whitespace-nowrap">{getCategoryBadge(log.category)}</td>

										{/* Akcja */}
										<td className="py-3.5 px-4 whitespace-nowrap">{getActionLabel(log.action)}</td>

										{/* Użytkownik */}
										<td className="py-3.5 px-4 whitespace-nowrap">
											{log.userName || log.userEmail ? (
												<div className="flex flex-col">
													<span className="font-semibold text-slate-800 text-xs">
														{log.userName || log.userEmail}
													</span>
													{log.userRole && (
														<span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
															{log.userRole}
														</span>
													)}
												</div>
											) : log.userRole ? (
												<div className="flex flex-col">
													<span className="font-semibold text-slate-800 text-xs">
														{log.userRole}
													</span>
													{log.userId && (
														<span className="text-[10px] text-slate-400 font-mono">
															{log.userId.slice(0, 8)}...
														</span>
													)}
												</div>
											) : (
												<span className="text-xs text-slate-400 italic">Gość / System</span>
											)}
										</td>

										{/* Obiekt docelowy */}
										<td className="py-3.5 px-4 max-w-[200px] truncate text-xs font-medium text-slate-700">
											{log.entityName || (log.entityId ? <span className="font-mono text-slate-400">{log.entityId}</span> : '—')}
										</td>

										{/* Szczegóły */}
										<td className="py-3.5 px-4 max-w-[240px] truncate text-xs text-slate-600" title={log.details || ''}>
											{log.details || '—'}
										</td>

										{/* IP */}
										<td className="py-3.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
											{log.ipAddress || '—'}
										</td>

										{/* Opcje */}
										<td className="py-3.5 px-4 text-right whitespace-nowrap">
											<button
												onClick={(e) => {
													e.stopPropagation();
													setSelectedLog(log);
												}}
												className="p-1.5 text-slate-400 group-hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
												title="Zobacz pełne szczegóły"
											>
												<InfoCircleFill size={16} />
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* PAGINACJA */}
				<div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
					<div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
						<span>
							Strona <strong className="text-slate-800">{page}</strong> z{' '}
							<strong className="text-slate-800">{totalPages || 1}</strong> (łączna liczba rekordów: {totalCount})
						</span>
						<div className="flex items-center gap-1.5">
							<span>Na stronę:</span>
							<select
								value={pageSize}
								onChange={(e) => {
									setPageSize(Number(e.target.value));
									setPage(1);
								}}
								className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer"
							>
								<option value={15}>15</option>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
							</select>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page <= 1 || isLoading}
							className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
						>
							Poprzednia
						</button>
						<button
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page >= totalPages || isLoading}
							className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
						>
							Następna
						</button>
					</div>
				</div>
			</div>

			{/* MODAL SZCZEGÓŁÓW WPISU AUDYTOWEGO */}
			{selectedLog && (
				<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-enter">
						{/* Header */}
						<div className="p-5 border-b border-slate-100 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
									<JournalText size={20} />
								</div>
								<div>
									<h2 className="text-lg font-bold text-slate-800">Szczegóły zdarzenia audytowego</h2>
									<p className="text-xs text-slate-400 font-mono">ID: {selectedLog.id}</p>
								</div>
							</div>
							<button
								onClick={() => setSelectedLog(null)}
								className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
							>
								<XLg size={16} />
							</button>
						</div>

						{/* Treść */}
						<div className="p-6 overflow-y-auto space-y-4 text-sm">
							<div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
								<div>
									<span className="text-[11px] font-bold text-slate-400 uppercase">Data i czas</span>
									<p className="font-semibold text-slate-800">{formatDate(selectedLog.timestamp)}</p>
								</div>
								<div>
									<span className="text-[11px] font-bold text-slate-400 uppercase">Kategoria</span>
									<div className="mt-0.5">{getCategoryBadge(selectedLog.category)}</div>
								</div>
								<div>
									<span className="text-[11px] font-bold text-slate-400 uppercase">Zdarzenie / Akcja</span>
									<div className="mt-0.5">{getActionLabel(selectedLog.action)}</div>
								</div>
								<div>
									<span className="text-[11px] font-bold text-slate-400 uppercase">Adres IP</span>
									<p className="font-mono text-xs text-slate-700 mt-0.5">{selectedLog.ipAddress || '—'}</p>
								</div>
							</div>

							<div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
								<span className="text-[11px] font-bold text-slate-400 uppercase">Wykonawca</span>
								<div className="text-slate-800">
									{selectedLog.userName && <p className="font-bold">{selectedLog.userName}</p>}
									{selectedLog.userEmail && <p className="text-xs text-slate-600">{selectedLog.userEmail}</p>}
									{selectedLog.userRole && (
										<span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
											Rola: {selectedLog.userRole}
										</span>
									)}
									{selectedLog.userId && (
										<p className="text-[11px] text-slate-400 font-mono mt-1">ID Użytkownika: {selectedLog.userId}</p>
									)}
									{!selectedLog.userName && !selectedLog.userEmail && !selectedLog.userRole && !selectedLog.userId && (
										<p className="text-xs text-slate-400 italic">Brak powiązanego użytkownika (Gość / System)</p>
									)}
								</div>
							</div>

							{(selectedLog.entityName || selectedLog.entityId) && (
								<div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
									<span className="text-[11px] font-bold text-slate-400 uppercase">Obiekt docelowy</span>
									{selectedLog.entityName && <p className="font-bold text-slate-800">{selectedLog.entityName}</p>}
									{selectedLog.entityId && (
										<p className="text-xs font-mono text-slate-500">ID Obiektu: {selectedLog.entityId}</p>
									)}
								</div>
							)}

							<div>
								<span className="text-[11px] font-bold text-slate-400 uppercase">Szczegóły operacji</span>
								<div className="mt-1 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs whitespace-pre-wrap break-all border border-slate-800">
									{selectedLog.details || 'Brak dodatkowych szczegółów.'}
								</div>
							</div>
						</div>

						{/* Footer */}
						<div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
							<button
								onClick={() => setSelectedLog(null)}
								className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
							>
								Zamknij
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL CZYSZCZENIA DANYCH RETENCYJNYCH */}
			{isCleanupModalOpen && (
				<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-enter">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
								<Trash size={24} />
							</div>
							<div>
								<h2 className="text-lg font-black text-slate-900">Czyszczenie starych logów</h2>
								<p className="text-xs text-slate-500">Usuwanie zarchiwizowanych wpisów z bazy</p>
							</div>
						</div>

						<p className="text-sm text-slate-600 leading-relaxed">
							Ta operacja trwale usunie wpisy z rejestru zdarzeń starsze niż wybrana liczba dni. Zaleca się
							zachowanie co najmniej 30–90 dni historii audytowej.
						</p>

						<div>
							<label className="block text-xs font-bold text-slate-600 uppercase mb-2">
								Usuń wpisy starsze niż:
							</label>
							<select
								value={cleanupDays}
								onChange={(e) => setCleanupDays(Number(e.target.value))}
								className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 cursor-pointer"
							>
								<option value={14}>14 dni</option>
								<option value={30}>30 dni (1 miesiąc)</option>
								<option value={60}>60 dni (2 miesiące)</option>
								<option value={90}>90 dni (3 miesiące - zalecane)</option>
								<option value={180}>180 dni (pół roku)</option>
								<option value={365}>365 dni (1 rok)</option>
							</select>
						</div>

						<div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
							<button
								onClick={() => setIsCleanupModalOpen(false)}
								disabled={isCleaning}
								className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
							>
								Anuluj
							</button>
							<button
								onClick={handleCleanup}
								disabled={isCleaning}
								className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
							>
								{isCleaning ? 'Usuwanie...' : 'Potwierdź i wyczyść'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
