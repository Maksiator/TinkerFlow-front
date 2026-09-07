import { useState, useEffect, useCallback } from 'react';
import {
	DatabaseCheck,
	DatabaseExclamation,
	ArrowClockwise,
	Trash,
	CheckCircleFill,
	ExclamationTriangleFill,
	ChevronDown,
	ChevronUp,
	InfoCircleFill,
	XLg,
	ShieldCheck,
} from 'react-bootstrap-icons';
import {
	maintenanceService,
	type OrphanReportResponse,
} from '../api/maintenanceService';
import toast from 'react-hot-toast';

export function AdminMaintenance() {
	const [report, setReport] = useState<OrphanReportResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
	const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
	const [isCleaning, setIsCleaning] = useState(false);
	const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

	const fetchReport = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await maintenanceService.getOrphans();
			setReport(data);
			// Domyślnie zaznaczamy kategorie, które mają jakieś błędy
			const withErrors = data.categories.filter((c) => c.count > 0).map((c) => c.key);
			setSelectedCategories(withErrors);
		} catch (error: any) {
			console.error('Błąd pobierania raportu osieroconych rekordów:', error);
			toast.error(error.response?.data?.message || 'Nie udało się pobrać raportu integralności bazy.');
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchReport();
	}, [fetchReport]);

	const toggleCategoryExpansion = (key: string) => {
		setExpandedCategories((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const handleToggleSelectCategory = (key: string) => {
		setSelectedCategories((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
		);
	};

	const handleSelectAllWithErrors = () => {
		if (!report) return;
		const withErrors = report.categories.filter((c) => c.count > 0).map((c) => c.key);
		if (selectedCategories.length === withErrors.length) {
			setSelectedCategories([]);
		} else {
			setSelectedCategories(withErrors);
		}
	};

	const handleExecuteCleanup = async () => {
		if (selectedCategories.length === 0) {
			toast.error('Wybierz przynajmniej jedną kategorię do wyczyszczenia.');
			return;
		}

		setIsCleaning(true);
		try {
			const res = await maintenanceService.cleanupOrphans(selectedCategories);
			toast.success(res.message);
			setIsConfirmModalOpen(false);
			await fetchReport();
		} catch (error: any) {
			console.error('Błąd czyszczenia rekordów:', error);
			toast.error(error.response?.data?.message || 'Błąd podczas czyszczenia bazy danych.');
		} finally {
			setIsCleaning(false);
		}
	};

	const categoriesWithErrors = report?.categories.filter((c) => c.count > 0) || [];
	const cleanCategories = report?.categories.filter((c) => c.count === 0) || [];

	return (
		<div className="p-6 md:p-8">
			{/* NAGŁÓWEK */}
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-3">
						<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
							<DatabaseCheck size={24} />
						</div>
						<div>
							<h1 className="text-2xl font-black tracking-tight text-slate-800">
								Integralność Bazy Danych
							</h1>
							<p className="text-sm font-semibold text-slate-500">
								Wykrywanie i usuwanie osieroconych rekordów oraz martwych powiązań w systemie
							</p>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<button
						onClick={fetchReport}
						disabled={isLoading || isCleaning}
						className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
					>
						<ArrowClockwise className={isLoading ? 'animate-spin' : ''} size={16} />
						Skanuj ponownie
					</button>

					{categoriesWithErrors.length > 0 && (
						<button
							onClick={() => setIsConfirmModalOpen(true)}
							disabled={isLoading || isCleaning || selectedCategories.length === 0}
							className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
						>
							<Trash size={16} />
							Wyczyść wybrane ({selectedCategories.length})
						</button>
					)}
				</div>
			</div>

			{/* KARTY PODSUMOWANIA */}
			{report && !isLoading && (
				<div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
						<span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
							Status Integralności
						</span>
						<div className="mt-2 flex items-center gap-3">
							{report.totalOrphansCount === 0 ? (
								<>
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
										<ShieldCheck size={22} />
									</div>
									<div>
										<p className="text-lg font-black text-emerald-600">Baza w 100% Spójna</p>
										<p className="text-xs font-semibold text-slate-500">Brak uszkodzonych powiązań</p>
									</div>
								</>
							) : (
								<>
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
										<DatabaseExclamation size={22} />
									</div>
									<div>
										<p className="text-lg font-black text-amber-600">Wykryto Niespójności</p>
										<p className="text-xs font-semibold text-slate-500">Wymagane czyszczenie</p>
									</div>
								</>
							)}
						</div>
					</div>

					<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
						<span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
							Liczba Osieroconych Wpisów
						</span>
						<p
							className={`mt-2 text-3xl font-black ${
								report.totalOrphansCount > 0 ? 'text-red-600' : 'text-slate-800'
							}`}
						>
							{report.totalOrphansCount}
						</p>
						<p className="text-xs font-semibold text-slate-500">
							Rekordów wymagających uwagi lub zerowania referencji
						</p>
					</div>

					<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
						<span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
							Ostatnie Skanowanie
						</span>
						<p className="mt-2 text-lg font-black text-slate-800">
							{new Date(report.checkedAt).toLocaleTimeString('pl-PL', {
								hour: '2-digit',
								minute: '2-digit',
								second: '2-digit',
							})}
						</p>
						<p className="text-xs font-semibold text-slate-500">
							{new Date(report.checkedAt).toLocaleDateString('pl-PL', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})}
						</p>
					</div>
				</div>
			)}

			{/* STAN ŁADOWANIA */}
			{isLoading && (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 shadow-xs">
					<ArrowClockwise className="h-10 w-10 animate-spin text-blue-600" />
					<p className="mt-4 font-bold text-slate-700">Analizowanie powiązań w bazie danych...</p>
					<p className="text-xs font-semibold text-slate-400">
						Sprawdzamy klucze obce dla uczniów, grup, projektów i wydruków
					</p>
				</div>
			)}

			{/* WYNIKI SKANOWANIA */}
			{!isLoading && report && (
				<div className="space-y-6">
					{/* SEKCJA 1: KATEGORIE Z BŁĘDAMI */}
					{categoriesWithErrors.length > 0 ? (
						<div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-xs">
							<div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
								<div>
									<h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
										<ExclamationTriangleFill className="text-amber-500" size={18} />
										Wykryte niespójności ({categoriesWithErrors.length})
									</h2>
									<p className="text-xs font-semibold text-slate-600">
										Poniższe tabele zawierają rekordy wskazujące na nieistniejące obiekty nadrzędne.
									</p>
								</div>

								<button
									onClick={handleSelectAllWithErrors}
									className="cursor-pointer text-xs font-bold text-blue-600 hover:underline"
								>
									{selectedCategories.length === categoriesWithErrors.length
										? 'Odznacz wszystkie'
										: 'Zaznacz wszystkie'}
								</button>
							</div>

							<div className="space-y-3">
								{categoriesWithErrors.map((category) => {
									const isExpanded = !!expandedCategories[category.key];
									const isSelected = selectedCategories.includes(category.key);

									return (
										<div
											key={category.key}
											className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-xs transition"
										>
											<div className="flex items-center justify-between p-4">
												<div className="flex items-center gap-3">
													<input
														type="checkbox"
														checked={isSelected}
														onChange={() => handleToggleSelectCategory(category.key)}
														className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
													/>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-bold text-slate-800">{category.name}</span>
															<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-extrabold text-red-600">
																{category.count}
															</span>
														</div>
														<p className="text-xs text-slate-500">{category.description}</p>
													</div>
												</div>

												<button
													onClick={() => toggleCategoryExpansion(category.key)}
													className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
												>
													{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
												</button>
											</div>

											{/* ROZWIJANA LISTA ELEMENTÓW */}
											{isExpanded && (
												<div className="border-t border-slate-100 bg-slate-50/70 p-4">
													<div className="max-h-64 space-y-2 overflow-y-auto">
														{category.items.map((item, idx) => (
															<div
																key={item.id || idx}
																className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs sm:flex-row sm:items-center"
															>
																<div>
																	<p className="font-bold text-slate-800">{item.reason}</p>
																	<p className="text-slate-500 font-mono text-[11px]">
																		ID: {item.id}
																	</p>
																</div>
																{item.additionalInfo && (
																	<span className="mt-1 inline-block rounded bg-slate-100 px-2 py-1 font-semibold text-slate-600 sm:mt-0">
																		{item.additionalInfo}
																	</span>
																)}
															</div>
														))}
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/50 p-12 text-center shadow-xs">
							<CheckCircleFill size={48} className="text-emerald-500" />
							<h3 className="mt-3 text-lg font-black text-slate-800">Baza Danych Jest Czysta!</h3>
							<p className="mt-1 max-w-md text-xs font-semibold text-slate-500">
								Nie znaleziono żadnych osieroconych projektów, wydruków ani uszkodzonych referencji w
								bazie danych.
							</p>
						</div>
					)}

					{/* SEKCJA 2: KATEGORIE SPÓJNE */}
					{cleanCategories.length > 0 && (
						<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
							<h2 className="mb-3 text-sm font-black tracking-wider text-slate-400 uppercase">
								Sprawdzone tabele bez błędów ({cleanCategories.length})
							</h2>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{cleanCategories.map((c) => (
									<div
										key={c.key}
										className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
									>
										<span className="text-xs font-bold text-slate-700">{c.name}</span>
										<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
											<CheckCircleFill size={14} /> Spójna
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* MODAL POTWIERDZENIA CZYSZCZENIA */}
			{isConfirmModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
					<div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
									<Trash size={20} />
								</div>
								<div>
									<h3 className="text-lg font-black text-slate-800">
										Potwierdź czyszczenie osieroconych danych
									</h3>
									<p className="text-xs font-semibold text-slate-500">
										Ta operacja zmodyfikuje bazę danych
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsConfirmModalOpen(false)}
								className="cursor-pointer text-slate-400 hover:text-slate-600"
							>
								<XLg size={18} />
							</button>
						</div>

						<div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-slate-700 space-y-2">
							<p className="flex items-center gap-2 font-bold text-amber-800">
								<InfoCircleFill size={15} />
								Jak działa czyszczenie?
							</p>
							<ul className="list-disc pl-5 space-y-1">
								<li>
									Dla tabel powiązań (np. <strong>Projekty uczniów</strong>, <strong>Wydruki</strong>,{' '}
									<strong>Zastępstwa</strong>) usunięte zostaną wpisy, które straciły nadrzędny obiekt.
								</li>
								<li>
									Dla obiektów nadrzędnych (np. <strong>Uczniowie</strong> mający ID usuniętej grupy) uczeń{' '}
									<strong>nie zostanie usunięty</strong>, a jedynie pole zostanie bezpiecznie wyzerowane (
									<code className="text-amber-900 bg-amber-100 px-1 rounded">GroupId = null</code>).
								</li>
								<li>Operacja zostanie odnotowana w Dzienniku Zdarzeń.</li>
							</ul>
						</div>

						<p className="mb-4 text-sm font-bold text-slate-700">
							Wybrane kategorie do naprawy ({selectedCategories.length}):
						</p>
						<div className="mb-6 max-h-32 overflow-y-auto space-y-1">
							{selectedCategories.map((key) => {
								const cat = report?.categories.find((c) => c.key === key);
								return (
									<div
										key={key}
										className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
									>
										<span className="font-bold text-slate-700">{cat?.name || key}</span>
										<span className="font-mono text-red-600 font-bold">{cat?.count} błędów</span>
									</div>
								);
							})}
						</div>

						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setIsConfirmModalOpen(false)}
								disabled={isCleaning}
								className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								type="button"
								onClick={handleExecuteCleanup}
								disabled={isCleaning}
								className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
							>
								{isCleaning ? (
									<>
										<ArrowClockwise className="animate-spin" size={15} />
										Naprawianie...
									</>
								) : (
									<>
										<Trash size={15} />
										Potwierdź i wyczyść
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
