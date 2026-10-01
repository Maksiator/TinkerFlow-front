import { useState, useEffect } from 'react';
import {
	XLg,
	PrinterFill,
	CalendarRange,
	CheckCircleFill,
	ExclamationTriangleFill,
	BoxSeam,
	PeopleFill,
	ClipboardCheck,
	ChevronDown,
	ChevronUp,
	ArrowClockwise,
	BarChartFill,
} from 'react-bootstrap-icons';
import { printBatchService, type PrinterSummaryResponse, PrintJobsStates } from '../api/printBatchService';
import { userService, type User, UserRole } from '../api/userService';
import { authService } from '../api/authService';
import toast from 'react-hot-toast';

interface PrinterSummaryModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function PrinterSummaryModal({ isOpen, onClose }: PrinterSummaryModalProps) {
	const currentUser = authService.getCurrentUser();
	const isAdminOrCoordinator = currentUser?.role === UserRole.Admin || currentUser?.role === UserRole.Coordinator;

	// Helpery do obliczania domyślnych dat
	const getMonthRange = (offsetMonths: number = 0) => {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + offsetMonths;
		const start = new Date(year, month, 1);
		const end = new Date(year, month + 1, 0);
		return {
			start: start.toISOString().split('T')[0],
			end: end.toISOString().split('T')[0],
		};
	};

	const getWeekRange = () => {
		const now = new Date();
		const day = now.getDay();
		const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
		const monday = new Date(now.setDate(diffToMonday));
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		return {
			start: monday.toISOString().split('T')[0],
			end: sunday.toISOString().split('T')[0],
		};
	};

	const getLast30DaysRange = () => {
		const end = new Date();
		const start = new Date();
		start.setDate(end.getDate() - 30);
		return {
			start: start.toISOString().split('T')[0],
			end: end.toISOString().split('T')[0],
		};
	};

	// Domyślnie bieżący miesiąc
	const defaultMonth = getMonthRange(0);
	const [fromDate, setFromDate] = useState<string>(defaultMonth.start);
	const [toDate, setToDate] = useState<string>(defaultMonth.end);
	const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
	const [dateField, setDateField] = useState<'lessonDate' | 'createdAt'>('lessonDate');

	// Lista drukarzy do wyboru dla Admina / Koordynatora
	const [printersList, setPrintersList] = useState<User[]>([]);
	const [isPrintersLoading, setIsPrintersLoading] = useState(false);

	// Stan raportu
	const [summaryData, setSummaryData] = useState<PrinterSummaryResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

	// Pobieranie listy drukarzy (dla Admina/Koordynatora)
	useEffect(() => {
		if (isOpen && isAdminOrCoordinator) {
			setIsPrintersLoading(true);
			userService
				.getAll(undefined, 1, 100)
				.then((res) => {
					// Filtrujemy tylko tych, którzy są drukarzami lub mogą działać jako drukarz
					const printers = res.items.filter(
						(u) => u.role === UserRole.Printer || u.canActAsPrinter
					);
					setPrintersList(printers);
				})
				.catch((err) => {
					console.error('Błąd pobierania drukarzy:', err);
				})
				.finally(() => {
					setIsPrintersLoading(false);
				});
		}
	}, [isOpen, isAdminOrCoordinator]);

	// Pobieranie raportu
	const fetchSummary = async () => {
		setIsLoading(true);
		try {
			const data = await printBatchService.getPrinterSummary({
				fromDate: fromDate || undefined,
				toDate: toDate || undefined,
				printerId: selectedPrinterId || undefined,
				dateField,
			});
			setSummaryData(data);
		} catch (err) {
			console.error(err);
			toast.error('Błąd podczas pobierania podsumowania.');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			fetchSummary();
		}
	}, [isOpen, fromDate, toDate, selectedPrinterId, dateField]);

	if (!isOpen) return null;

	const handleApplyPreset = (preset: 'thisMonth' | 'prevMonth' | 'thisWeek' | 'last30') => {
		if (preset === 'thisMonth') {
			const r = getMonthRange(0);
			setFromDate(r.start);
			setToDate(r.end);
		} else if (preset === 'prevMonth') {
			const r = getMonthRange(-1);
			setFromDate(r.start);
			setToDate(r.end);
		} else if (preset === 'thisWeek') {
			const r = getWeekRange();
			setFromDate(r.start);
			setToDate(r.end);
		} else if (preset === 'last30') {
			const r = getLast30DaysRange();
			setFromDate(r.start);
			setToDate(r.end);
		}
	};

	const toggleGroupExpand = (groupId: string) => {
		setExpandedGroupIds((prev) =>
			prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
		);
	};

	const handleCopySummary = () => {
		if (!summaryData) return;

		let printerText = 'Wszyscy drukarze';
		if (selectedPrinterId) {
			const found = printersList.find((p) => p.id === selectedPrinterId);
			if (found) printerText = `${found.firstName} ${found.lastName}`;
		} else if (currentUser?.role === UserRole.Printer) {
			printerText = `${currentUser.firstName} ${currentUser.lastName}`;
		}

		const lines = [
			`📊 *Podsumowanie wydruków TinkerFlow*`,
			`📅 Okres: ${fromDate} do ${toDate}`,
			`🖨️ Drukarz: ${printerText}`,
			`----------------------------------`,
			`🚀 Wydrukowane modele: ${summaryData.totalModelsPrinted} szt.`,
			`📦 Zrealizowane paczki: ${summaryData.totalBatchesCompleted}`,
			`👥 Liczba grup: ${summaryData.totalGroups}`,
			summaryData.totalModelsFailed > 0 ? `⚠️ Błędy druku: ${summaryData.totalModelsFailed} szt.` : '',
			`----------------------------------`,
			`Podział na grupy:`,
			...summaryData.groupsSummary.map(
				(g) => `• ${g.groupName}: ${g.modelsPrintedCount} modeli (${g.batchesCount} paczek)`
			),
		].filter(Boolean);

		navigator.clipboard.writeText(lines.join('\n'));
		toast.success('Skopiowano podsumowanie do schowka!');
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
				{/* NAGŁÓWEK */}
				<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
							<BarChartFill size={20} />
						</div>
						<div>
							<h2 className="text-xl font-extrabold text-slate-800">Rozliczenie pracy drukarza</h2>
							<p className="text-xs text-slate-500">
								Zestawienie liczby wydrukowanych modeli w wybranym przedziale czasowym.
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
						title="Zamknij"
					>
						<XLg size={18} />
					</button>
				</div>

				{/* TREŚĆ MODALU */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* PANEL FILTRÓW I ZAKRESU */}
					<div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
						{/* SZYBKIE SKRÓTY */}
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
								<CalendarRange size={13} /> Szybki zakres:
							</span>
							<button
								type="button"
								onClick={() => handleApplyPreset('thisMonth')}
								className="cursor-pointer rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors shadow-xs"
							>
								Ten miesiąc
							</button>
							<button
								type="button"
								onClick={() => handleApplyPreset('prevMonth')}
								className="cursor-pointer rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors shadow-xs"
							>
								Poprzedni miesiąc
							</button>
							<button
								type="button"
								onClick={() => handleApplyPreset('thisWeek')}
								className="cursor-pointer rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors shadow-xs"
							>
								Ten tydzień
							</button>
							<button
								type="button"
								onClick={() => handleApplyPreset('last30')}
								className="cursor-pointer rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors shadow-xs"
							>
								Ostatnie 30 dni
							</button>
						</div>

						{/* FORMULARZ DAT I DRUKARZA */}
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
							<div>
								<label className="block text-xs font-bold text-slate-600 mb-1">Od daty</label>
								<input
									type="date"
									value={fromDate}
									onChange={(e) => setFromDate(e.target.value)}
									className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-xs"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-600 mb-1">Do daty</label>
								<input
									type="date"
									value={toDate}
									onChange={(e) => setToDate(e.target.value)}
									className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-xs"
								/>
							</div>

							{isAdminOrCoordinator && (
								<div>
									<label className="block text-xs font-bold text-slate-600 mb-1">Drukarz</label>
									<select
										value={selectedPrinterId}
										onChange={(e) => setSelectedPrinterId(e.target.value)}
										disabled={isPrintersLoading}
										className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-xs"
									>
										<option value="">Wszyscy drukarze</option>
										{printersList.map((p) => (
											<option key={p.id} value={p.id}>
												{p.firstName} {p.lastName}
											</option>
										))}
									</select>
								</div>
							)}

							<div>
								<label className="block text-xs font-bold text-slate-600 mb-1">Filtruj wg daty</label>
								<select
									value={dateField}
									onChange={(e) => setDateField(e.target.value as any)}
									className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-xs"
								>
									<option value="lessonDate">Data zajęć (zalecane)</option>
									<option value="createdAt">Data zgłoszenia paczki</option>
								</select>
							</div>
						</div>
					</div>

					{/* KAFELKI Z WYNIKAMI (KPIS) */}
					{isLoading ? (
						<div className="py-12 flex flex-col items-center justify-center gap-3 text-purple-600">
							<ArrowClockwise className="animate-spin" size={28} />
							<p className="text-sm font-bold text-slate-500">Przeliczanie wydruków z bazy...</p>
						</div>
					) : summaryData ? (
						<>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{/* GŁÓWNY WYNIK: WYDRUKOWANE MODELE */}
								<div className="rounded-2xl border-2 border-purple-500 bg-gradient-to-br from-purple-600 to-indigo-700 p-5 text-white shadow-lg shadow-purple-500/10 col-span-2 sm:col-span-1">
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold uppercase tracking-wider text-purple-200">
											Wydrukowane modele
										</span>
										<PrinterFill className="text-purple-200" size={20} />
									</div>
									<div className="mt-2 text-4xl font-black tracking-tight">
										{summaryData.totalModelsPrinted}
										<span className="ml-1 text-sm font-normal text-purple-200">szt.</span>
									</div>
									<p className="mt-1 text-[11px] text-purple-200">
										Fizycznie wydrukowane modele 3D
									</p>
								</div>

								{/* ZREALIZOWANE PACZKI */}
								<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
											Zrealizowane paczki
										</span>
										<BoxSeam className="text-blue-500" size={20} />
									</div>
									<div className="mt-2 text-3xl font-extrabold text-slate-800">
										{summaryData.totalBatchesCompleted}
									</div>
									<p className="mt-1 text-[11px] text-slate-400">Gotowe lub odebrane</p>
								</div>

								{/* OBSŁUŻONE GRUPY */}
								<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
											Obsłużone grupy
										</span>
										<PeopleFill className="text-emerald-500" size={20} />
									</div>
									<div className="mt-2 text-3xl font-extrabold text-slate-800">
										{summaryData.totalGroups}
									</div>
									<p className="mt-1 text-[11px] text-slate-400">Z przypisanymi wydrukami</p>
								</div>

								{/* BŁĘDY DRUKU */}
								<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
											Błędy druku
										</span>
										<ExclamationTriangleFill
											className={summaryData.totalModelsFailed > 0 ? 'text-amber-500' : 'text-slate-300'}
											size={20}
										/>
									</div>
									<div
										className={`mt-2 text-3xl font-extrabold ${
											summaryData.totalModelsFailed > 0 ? 'text-amber-600' : 'text-slate-800'
										}`}
									>
										{summaryData.totalModelsFailed}
										<span className="ml-1 text-sm font-normal text-slate-400">szt.</span>
									</div>
									<p className="mt-1 text-[11px] text-slate-400">Oznaczone jako nieudane</p>
								</div>
							</div>

							{/* TABELA PODZIAŁU NA GRUPY */}
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-extrabold text-slate-800">
										Rozbicie szczegółowe według grup ({summaryData.groupsSummary.length})
									</h3>
									<span className="text-xs text-slate-400">
										Kliknij wiersz grupy, aby zobaczyć szczegóły paczek i uczniów
									</span>
								</div>

								{summaryData.groupsSummary.length === 0 ? (
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
										Brak wydruków w wybranym przedziale czasowym.
									</div>
								) : (
									<div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
										{summaryData.groupsSummary.map((group) => {
											const isExpanded = expandedGroupIds.includes(group.groupId);
											return (
												<div key={group.groupId} className="transition-colors hover:bg-slate-50/50">
													<div
														onClick={() => toggleGroupExpand(group.groupId)}
														className="flex cursor-pointer items-center justify-between p-4"
													>
														<div className="flex items-center gap-3">
															<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
																<PeopleFill size={16} />
															</div>
															<div>
																<div className="flex items-center gap-2">
																	<span className="font-bold text-slate-800">{group.groupName}</span>
																	{group.branchName && (
																		<span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
																			{group.branchName}
																		</span>
																	)}
																</div>
																{group.assignedPrinterName && isAdminOrCoordinator && (
																	<span className="text-xs text-slate-400">
																		Drukarz: {group.assignedPrinterName}
																	</span>
																)}
															</div>
														</div>

														<div className="flex items-center gap-4">
															<div className="text-right">
																<div className="text-base font-black text-purple-700">
																	{group.modelsPrintedCount} modeli
																</div>
																<div className="text-xs text-slate-400">
																	{group.batchesCount} {group.batchesCount === 1 ? 'paczka' : 'paczki'}
																	{group.modelsFailedCount > 0 && (
																		<span className="ml-1 text-red-500">
																			({group.modelsFailedCount} błędów)
																		</span>
																	)}
																</div>
															</div>
															<div className="text-slate-400">
																{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
															</div>
														</div>
													</div>

													{/* ROZWINIĘTE SZCZEGÓŁY PACZEK I MODELI */}
													{isExpanded && (
														<div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-3 animate-in fade-in duration-150">
															{group.batches.map((b) => (
																<div
																	key={b.batchId}
																	className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-xs"
																>
																	<div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
																		<div className="flex items-center gap-2">
																			<span className="font-bold text-slate-700">
																				Zajęcia: {new Date(b.lessonDate).toLocaleDateString('pl-PL')}
																			</span>
																			<span className="text-slate-400">
																				(zgłoszono {new Date(b.createdAt).toLocaleDateString('pl-PL')})
																			</span>
																		</div>
																		<span className="font-extrabold text-purple-700">
																			{b.modelsPrintedCount} wydrukowanych
																		</span>
																	</div>

																	{/* LISTA MODELI W PACZCE */}
																	<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
																		{b.jobs.map((job) => (
																			<div
																				key={job.jobId}
																				className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs ${
																					job.status === PrintJobsStates.Failed
																						? 'border-red-200 bg-red-50/50 text-red-700'
																						: 'border-slate-100 bg-slate-50/80 text-slate-700'
																				}`}
																			>
																				<div className="truncate mr-2">
																					<span className="font-semibold">{job.studentName}</span>
																					<span className="block text-[11px] text-slate-400 truncate">
																						{job.projectName}
																					</span>
																				</div>
																				{job.status === PrintJobsStates.Failed ? (
																					<span className="text-[10px] font-bold text-red-600">Błąd</span>
																				) : (
																					<CheckCircleFill className="text-green-500 shrink-0" size={13} />
																				)}
																			</div>
																		))}
																	</div>
																</div>
															))}
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
						</>
					) : null}
				</div>

				{/* STOPKA */}
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
					<button
						type="button"
						onClick={handleCopySummary}
						disabled={!summaryData || summaryData.totalModelsPrinted === 0}
						className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ClipboardCheck size={16} className="text-purple-600" />
						Kopiuj podsumowanie (tekst)
					</button>

					<button
						type="button"
						onClick={onClose}
						className="cursor-pointer rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
					>
						Zamknij
					</button>
				</div>
			</div>
		</div>
	);
}
