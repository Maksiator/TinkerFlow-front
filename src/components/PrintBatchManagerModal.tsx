import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
	XCircleFill,
	PrinterFill,
	BoxSeamFill,
	ExclamationTriangleFill,
	TrashFill,
	SlashCircle,
	Scissors,
	ChatLeftTextFill,
	CheckCircleFill,
} from 'react-bootstrap-icons';
import { printBatchService, type PrintBatchResponse, PrintBatchState, PrintJobsStates } from '../api/printBatchService';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import { PrintLabelsModal } from './PrintLabelsModal';

interface PrintBatchManagerModalProps {
	batch: PrintBatchResponse;
	isOpen: boolean;
	onClose: () => void;
	onRefreshNeeded: () => void;
	onBatchUpdated?: (updatedBatch: PrintBatchResponse) => void;
}

export const PrintBatchManagerModal: React.FC<PrintBatchManagerModalProps> = ({
	batch,
	isOpen,
	onClose,
	onRefreshNeeded,
	onBatchUpdated,
}) => {
	const currentUser = authService.getCurrentUser();
	const isAdmin = currentUser?.role === UserRole.Admin;

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingNotes, setIsSavingNotes] = useState(false);
	const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);

	// Stan lokalny dla wydruków (żeby dropdowny zmieniały się na żywo)
	const [localJobs, setLocalJobs] = useState(batch.printJobs);
	// Stan lokalny dla paczki (żeby wyłączać przyciski po kliknięciu i aktualizować status)
	const [localBatchStatus, setLocalBatchStatus] = useState(batch.status);
	// Stan lokalny dla notatki od drukarza
	const [printerNotes, setPrinterNotes] = useState(batch.printerNotes || '');

	useEffect(() => {
		setLocalJobs(batch.printJobs);
		setLocalBatchStatus(batch.status);
		setPrinterNotes(batch.printerNotes || '');
	}, [batch]);

	// Grupowanie wydruków po uczniu
	const groupedJobs = useMemo(() => {
		const groups: Record<string, typeof localJobs> = {};
		localJobs.forEach((job) => {
			if (!groups[job.studentName]) {
				groups[job.studentName] = [];
			}
			groups[job.studentName].push(job);
		});

		// Sortowanie alfabetyczne uczniów
		return Object.keys(groups)
			.sort()
			.reduce((acc, key) => {
				acc[key] = groups[key];
				return acc;
			}, {} as Record<string, typeof localJobs>);
	}, [localJobs]);

	if (!isOpen) return null;

	const handleSavePrinterNotes = async () => {
		setIsSavingNotes(true);
		try {
			const trimmed = printerNotes.trim();
			const result = await printBatchService.updatePrinterNotes(batch.id, trimmed !== '' ? trimmed : null);
			toast.success('Zapisano informację dla trenera!');
			onBatchUpdated?.({
				...batch,
				status: localBatchStatus,
				printJobs: localJobs,
				printerNotes: result.printerNotes,
			});
			onRefreshNeeded();
		} catch (error: unknown) {
			const errorMsg = error instanceof Error ? error.message : 'Błąd podczas zapisywania notatki.';
			toast.error(errorMsg);
		} finally {
			setIsSavingNotes(false);
		}
	};

	// ==========================================
	// 1. MASOWA ZMIANA (BULK UPDATE) CAŁEJ PACZKI
	// ==========================================
	const handleBatchStatusChange = async (newStatus: PrintBatchState) => {
		setIsSubmitting(true);
		try {
			// 1. Wysyłamy komendę do C# razem z ewentualną notatką dla trenera
			const trimmedNotes = printerNotes.trim() !== '' ? printerNotes.trim() : null;
			await printBatchService.updateBatchStatus(batch.id, newStatus, trimmedNotes);

			// 2. Magia na Froncie - optymistycznie aktualizujemy widok w Modalu!
			setLocalBatchStatus(newStatus);

			const nextJobs = localJobs.map((job) => {
				// Jeśli kliknęliśmy "W druku" -> wszystkie oczekujące zmieniają się na "Drukuje się"
				if (newStatus === PrintBatchState.Printing) {
					return job.status === PrintJobsStates.Pending ? { ...job, status: PrintJobsStates.Printing } : job;
				}
				// Jeśli kliknęliśmy "Do odbioru" -> wszystkie w druku i oczekujące zmieniają się na "Wydrukowano"
				else if (newStatus === PrintBatchState.ReadyForCollection) {
					return job.status === PrintJobsStates.Printing || job.status === PrintJobsStates.Pending
						? { ...job, status: PrintJobsStates.Printed }
						: job;
				}
				return job;
			});

			setLocalJobs(nextJobs);

			onBatchUpdated?.({
				...batch,
				status: newStatus,
				printJobs: nextJobs,
				printerNotes: trimmedNotes,
			});

			toast.success('Masowo zaktualizowano statusy!');
			onRefreshNeeded(); // Odświeżamy listę w tle (na Dashboardzie)
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Wystąpił błąd przy zmianie statusu paczki.';
			toast.error(errorMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	// ==========================================
	// 2. ZMIANA STATUSU POJEDYNCZEGO WYDRUKU (Ręczna korekta)
	// ==========================================
	const handleJobStatusChange = async (jobId: string, newStatus: PrintJobsStates) => {
		const previousJobs = [...localJobs];
		const previousBatchStatus = localBatchStatus;

		// 1. Optymistyczna aktualizacja listy zadań
		const nextJobs = localJobs.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j));
		setLocalJobs(nextJobs);

		// 2. Optymistyczna kalkulacja nowego statusu paczki
		let optimisticBatchStatus = localBatchStatus;
		if (
			nextJobs.length > 0 &&
			localBatchStatus !== PrintBatchState.Completed &&
			localBatchStatus !== PrintBatchState.NoPrints
		) {
			if (
				nextJobs.every((j) => j.status === PrintJobsStates.Printed || j.status === PrintJobsStates.Failed) &&
				nextJobs.some((j) => j.status === PrintJobsStates.Printed)
			) {
				optimisticBatchStatus = PrintBatchState.ReadyForCollection;
			} else if (nextJobs.some((j) => j.status === PrintJobsStates.Printing || j.status === PrintJobsStates.Printed)) {
				optimisticBatchStatus = PrintBatchState.Printing;
			} else if (nextJobs.every((j) => j.status === PrintJobsStates.Pending)) {
				optimisticBatchStatus = PrintBatchState.Pending;
			}
			setLocalBatchStatus(optimisticBatchStatus);
		}

		// 3. Natychmiastowe zsynchronizowanie z rodzicem (PrinterDashboard)
		const updatedBatch: PrintBatchResponse = {
			...batch,
			status: optimisticBatchStatus,
			printJobs: nextJobs,
		};
		onBatchUpdated?.(updatedBatch);

		try {
			const res = await printBatchService.updateJobStatus(jobId, newStatus);
			if (res.batchStatus !== undefined) {
				setLocalBatchStatus(res.batchStatus);
				onBatchUpdated?.({
					...updatedBatch,
					status: res.batchStatus,
				});
			}
			toast.success('Zaktualizowano status modelu.');
			onRefreshNeeded(); // Odświeżenie listy w tle na pulpicie
		} catch (error: unknown) {
			setLocalJobs(previousJobs);
			setLocalBatchStatus(previousBatchStatus);
			onBatchUpdated?.({
				...batch,
				status: previousBatchStatus,
				printJobs: previousJobs,
			});
			const errorMessage = error instanceof Error ? error.message : 'Nie udało się zaktualizować wydruku.';
			toast.error(errorMessage);
		}
	};

	// ==========================================
	// 3. CAŁKOWITE USUNIĘCIE PACZKI
	// ==========================================
	const handleDeleteBatch = async () => {
		const isConfirmed = window.confirm(
			'Czy na pewno chcesz usunąć tę paczkę?\n\nWszystkie zadania w niej zawarte zostaną cofnięte u trenera na status "Do druku".',
		);
		if (!isConfirmed) return;

		setIsSubmitting(true);
		try {
			await printBatchService.deleteBatch(batch.id);
			toast.success('Paczka została usunięta!');
			onRefreshNeeded();
			onClose();
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Nie udało się usunąć paczki.';
			toast.error(errorMessage);
			setIsSubmitting(false);
		}
	};

	// Stylizacja dropdownów
	const getJobStatusSelectClass = (status: PrintJobsStates) => {
		switch (status) {
			case PrintJobsStates.Pending:
				return 'bg-yellow-50 text-yellow-800 border-yellow-200';
			case PrintJobsStates.Printing:
				return 'bg-blue-50 text-blue-800 border-blue-200';
			case PrintJobsStates.Printed:
				return 'bg-green-50 text-green-800 border-green-200 font-bold';
			case PrintJobsStates.Failed:
				return 'bg-red-50 text-red-800 border-red-200 font-bold';
			default:
				return 'bg-white text-slate-800 border-slate-200';
		}
	};

	// Status paczki badge
	const getBatchStatusBadge = (status: PrintBatchState) => {
		switch (status) {
			case PrintBatchState.Pending:
				return <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-bold text-yellow-800">Oczekujące</span>;
			case PrintBatchState.Printing:
				return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">W druku</span>;
			case PrintBatchState.ReadyForCollection:
				return <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">Do odbioru</span>;
			case PrintBatchState.Completed:
				return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">Zakończone</span>;
			case PrintBatchState.NoPrints:
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
						<SlashCircle size={11} /> Brak wydruków
					</span>
				);
			default:
				return null;
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-opacity">
			<div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
				{/* NAGŁÓWEK */}
				<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5">
					<div>
						<div className="flex items-center gap-2.5">
							<h2 className="text-xl font-extrabold text-slate-800">Zarządzanie Paczką</h2>
							{getBatchStatusBadge(localBatchStatus)}
						</div>
						<p className="text-sm font-medium text-slate-500 mt-0.5">
							Grupa: <span className="text-purple-600 font-bold">{batch.groupName}</span> • Oddział: <span className="text-slate-700 font-semibold">{batch.branchName}</span>
						</p>
					</div>
					<div className="flex items-center gap-2">
						{isAdmin && batch.status !== PrintBatchState.NoPrints && localJobs.length > 0 && (
							<button
								type="button"
								onClick={() => setIsLabelsModalOpen(true)}
								disabled={isSubmitting}
								title="Drukuj etykiety do woreczków (Tylko Admin)"
								className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
							>
								<Scissors size={14} /> Etykiety do woreczków
							</button>
						)}
						<button
							onClick={handleDeleteBatch}
							disabled={isSubmitting}
							title="Usuń paczkę całkowicie"
							className="cursor-pointer rounded-lg p-2 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
						>
							<TrashFill size={20} />
						</button>
						<button
							onClick={onClose}
							disabled={isSubmitting}
							className="cursor-pointer rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50"
						>
							<XCircleFill size={24} />
						</button>
					</div>
				</div>

				{/* LISTA WYDRUKÓW */}
				<div className="flex-1 overflow-y-auto p-5">
					{batch.notes && (
						<div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
							<h3 className="mb-1 text-xs font-bold tracking-wider text-yellow-800 uppercase">Notatki trenera</h3>
							<p className="text-sm text-yellow-900 italic">{batch.notes}</p>
						</div>
					)}

					{/* Pole notatki / informacji od drukarza dla trenera */}
					{batch.status !== PrintBatchState.NoPrints && (
						<div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-xs">
							<div className="flex items-center justify-between mb-1.5">
								<label className="text-xs font-bold tracking-wider text-indigo-950 uppercase flex items-center gap-1.5">
									<ChatLeftTextFill size={13} className="text-indigo-600" />
									Informacja / notatka dla trenera
								</label>
								{printerNotes !== (batch.printerNotes || '') && (
									<span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
										Niezapisana zmiana
									</span>
								)}
							</div>
							<p className="text-xs text-slate-500 mb-2">
								Ta informacja wyświetli się trenerowi na matrycy w strefie odbioru paczki (np. inny kolor filamentu, uszkodzony element itp.).
							</p>
							<div className="flex flex-col sm:flex-row gap-2">
								<textarea
									rows={2}
									placeholder="Wpisz informację lub uwagi dla trenera..."
									value={printerNotes}
									onChange={(e) => setPrinterNotes(e.target.value)}
									disabled={isSubmitting || isSavingNotes}
									className="flex-1 rounded-lg border border-indigo-200 bg-white p-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
								/>
								<button
									type="button"
									onClick={handleSavePrinterNotes}
									disabled={isSubmitting || isSavingNotes || printerNotes === (batch.printerNotes || '')}
									className="cursor-pointer self-end sm:self-stretch px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
								>
									{isSavingNotes ? 'Zapisywanie...' : 'Zapisz notatkę'}
								</button>
							</div>
						</div>
					)}

					{batch.status === PrintBatchState.NoPrints ? (
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
							<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
								<SlashCircle size={24} />
							</div>
							<h3 className="text-base font-extrabold text-slate-800">Brak modeli do druku</h3>
							<p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
								Trener oznaczył, że na tych zajęciach nie realizowano projektów do druku 3D. Drukarz nie musi czekać na pliki z tej grupy.
							</p>
							{batch.notes && (
								<div className="mt-4 inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
									Powód / Notatka: <span className="text-slate-900 font-bold">{batch.notes}</span>
								</div>
							)}
						</div>
					) : (
						<>
							<h3 className="mb-3 text-sm font-bold text-slate-700">Wydruki w tej paczce ({localJobs.length})</h3>

							{localJobs.length === 0 ? (
								<div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6 text-center text-red-600">
									<ExclamationTriangleFill className="mx-auto mb-2 text-3xl" />
									<p className="font-bold">Ta paczka jest pusta!</p>
									<p className="text-sm">Użyj czerwonego kosza w prawym górnym rogu, aby ją usunąć.</p>
								</div>
							) : (
								<div className="flex flex-col gap-4">
									{Object.entries(groupedJobs).map(([studentName, jobs]) => (
										<div
											key={studentName}
											className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm flex flex-col gap-3"
										>
											{/* Nagłówek Ucznia */}
											<div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
												<span className="font-extrabold text-slate-800 text-sm">{studentName}</span>
												<span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-black text-purple-700">
													{jobs.length} {jobs.length === 1 ? 'model' : jobs.length < 5 ? 'modele' : 'modeli'}
												</span>
											</div>

											{/* Projekty Ucznia */}
											<div className="flex flex-col gap-2">
												{jobs.map((job) => {
													const isFailed = job.status === PrintJobsStates.Failed;
													const isCustom = !job.studentProjectId;
													return (
														<div
															key={job.id}
															className={`flex flex-col justify-between gap-2 sm:flex-row sm:items-center rounded-lg border p-2.5 shadow-xs transition-colors ${
																isFailed
																	? 'border-red-300 bg-red-50/70 hover:border-red-400'
																	: 'border-slate-200 bg-white hover:border-purple-300'
															}`}
														>
															<div className="flex flex-wrap items-center gap-1.5">
																<span className={`text-xs font-semibold ${isFailed ? 'text-red-900 line-through decoration-red-400' : 'text-slate-700'}`}>
																	{job.projectName}
																</span>
																{isCustom && (
																	<span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-black text-orange-700 border border-orange-200">
																		Własny
																	</span>
																)}
																{isFailed && (
																	<span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700 border border-red-200">
																		Błąd druku
																	</span>
																)}
															</div>

															<div className="flex items-center gap-2">
																{/* Szybki 1-klikowy przycisk dla drukarza */}
																{isFailed ? (
																	<button
																		type="button"
																		onClick={() => handleJobStatusChange(job.id, PrintJobsStates.Printed)}
																		disabled={isSubmitting}
																		title="Kliknij, aby cofnąć błąd i oznaczyć jako wydrukowano"
																		className="cursor-pointer flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
																	>
																		<CheckCircleFill size={12} className="text-green-600" />
																		<span>Oznacz: Wydrukowano</span>
																	</button>
																) : (
																	<button
																		type="button"
																		onClick={() => handleJobStatusChange(job.id, PrintJobsStates.Failed)}
																		disabled={isSubmitting}
																		title="Kliknij, aby szybko zgłosić błąd druku tego modelu bez mozolnego szukania w liście"
																		className="cursor-pointer flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
																	>
																		<XCircleFill size={12} className="text-red-500" />
																		<span>Zgłoś błąd druku</span>
																	</button>
																)}

																<select
																	value={job.status}
																	onChange={(e) => handleJobStatusChange(job.id, Number(e.target.value) as PrintJobsStates)}
																	disabled={isSubmitting}
																	className={`cursor-pointer rounded-lg border p-1.5 text-xs font-semibold transition-colors outline-none focus:ring-2 focus:ring-purple-500 ${getJobStatusSelectClass(job.status)}`}
																>
																	<option value={PrintJobsStates.Pending}>W kolejce</option>
																	<option value={PrintJobsStates.Printing}>Drukuje się</option>
																	<option value={PrintJobsStates.Printed}>Wydrukowano</option>
																	<option value={PrintJobsStates.Failed}>Błąd druku (Zepsute)</option>
																</select>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									))}
								</div>
							)}
						</>
					)}
				</div>

				{/* MASOWE AKCJE - "BULK UPDATE" (Tylko dla zwykłych paczek z wydrukami) */}
				{batch.status !== PrintBatchState.NoPrints && (
					<div className="border-t border-slate-100 bg-slate-50 p-5">
						<h3 className="mb-3 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">
							Masowa aktualizacja (Bulk Update)
						</h3>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<button
								onClick={() => handleBatchStatusChange(PrintBatchState.Printing)}
								disabled={
									isSubmitting ||
									localBatchStatus === PrintBatchState.Printing ||
									localBatchStatus === PrintBatchState.ReadyForCollection ||
									localJobs.length === 0
								}
								className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 p-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<PrinterFill /> Przekaż do druku
							</button>

							<button
								onClick={() => handleBatchStatusChange(PrintBatchState.ReadyForCollection)}
								disabled={
									isSubmitting || localBatchStatus === PrintBatchState.ReadyForCollection || localJobs.length === 0
								}
								className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 p-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<BoxSeamFill /> Gotowe do odbioru
							</button>
						</div>
					</div>
				)}
			</div>

			{/* MODAL DRUKOWANIA ETYKIET A4 (TYLKO DLA ADMINA) */}
			{isAdmin && isLabelsModalOpen && (
				<PrintLabelsModal
					isOpen={isLabelsModalOpen}
					onClose={() => setIsLabelsModalOpen(false)}
					allBatches={[
						{
							...batch,
							printJobs: localJobs,
						},
					]}
					selectedBatchIds={[batch.id]}
				/>
			)}
		</div>
	);
};
