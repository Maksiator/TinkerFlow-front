import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PrinterFill, XCircleFill, BoxSeamFill, InfoCircleFill } from 'react-bootstrap-icons';
import {
	printBatchService,
	type PrintJobRequest,
	type PrintBatchResponse,
	PrintJobsStates,
	PrintBatchState,
} from '../api/printBatchService';
import { ProjectState, type Project } from '../api/projectService';
import { type Student } from '../api/studentService';

interface PrintManagerPanelProps {
	groupId: string;
	lessonDate: string;
	matrixState: Record<string, ProjectState>;
	students: Student[];
	projects: Project[];
	onBatchSent: (sentMatrixKeys: string[]) => void;
	onBatchReceived: () => void;
	onClose: () => void;
}

export const PrintManagerPanel: React.FC<PrintManagerPanelProps> = ({
	groupId,
	lessonDate,
	matrixState,
	students,
	projects,
	onBatchSent,
	onBatchReceived,
	onClose,
}) => {
	// SYSTEM ZAKŁADEK (TABS)
	const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');

	// STANY DLA ZAKŁADKI WYSYŁKI
	const [notes, setNotes] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [readyBatch, setReadyBatch] = useState<PrintBatchResponse | null>(null);

	// STANY DLA ZAKŁADKI HISTORII
	const [historyBatches, setHistoryBatches] = useState<PrintBatchResponse[]>([]);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);

	// POBIERANIE DANYCH STARTOWYCH (Gotowa paczka do odbioru)
	useEffect(() => {
		let isMounted = true;
		const fetchReadyBatch = async () => {
			try {
				const batch = await printBatchService.getReadyBatchForGroup(groupId);
				if (isMounted) setReadyBatch(batch);
			} catch (error) {
				console.error(error);
			}
		};
		fetchReadyBatch();
		return () => {
			isMounted = false;
		};
	}, [groupId]);

	// POBIERANIE HISTORII
	useEffect(() => {
		let isMounted = true;
		if (activeTab === 'history') {
			const fetchHistory = async () => {
				setIsLoadingHistory(true);
				try {
					const data = await printBatchService.getBatchHistoryForGroup(groupId);
					if (isMounted) setHistoryBatches(data);
				} catch (error) {
					console.error(error);
				} finally {
					if (isMounted) setIsLoadingHistory(false);
				}
			};
			fetchHistory();
		}
		return () => {
			isMounted = false;
		};
	}, [groupId, activeTab]);

	// LOGIKA WYLICZANIA PROJEKTÓW DO DRUKU Z MATRYCY
	const readyToPrint = useMemo(() => {
		const toPrint: {
			matrixKey: string;
			studentId: string;
			studentName: string;
			projectId: string;
			projectName: string;
		}[] = [];
		Object.entries(matrixState).forEach(([key, status]) => {
			if (status === ProjectState.ReadyToPrint) {
				const [studentId, matrixProjectId] = key.split('_');
				const student = students.find((s) => s.id === studentId);
				const project = projects.find((p) => p.id === matrixProjectId);
				if (student && project) {
					toPrint.push({
						matrixKey: key,
						studentId,
						studentName: `${student.firstName} ${student.lastName}`,
						projectId: project.id,
						projectName: project.name,
					});
				}
			}
		});
		toPrint.sort((a, b) => a.studentName.localeCompare(b.studentName));
		return toPrint;
	}, [matrixState, students, projects]);

	const groupedToPrint = readyToPrint.reduce(
		(acc, item) => {
			if (!acc[item.studentName]) acc[item.studentName] = [];
			acc[item.studentName].push(item.projectName);
			return acc;
		},
		{} as Record<string, string[]>,
	);

	const hasItemsToPrint = readyToPrint.length > 0;

	// AKCJA 1: WYSYŁKA NOWEJ PACZKI
	const handleSendToFarm = async () => {
		if (!hasItemsToPrint) return;
		setIsSubmitting(true);
		try {
			const projectsToPrint: PrintJobRequest[] = readyToPrint.map((item) => ({
				studentId: item.studentId,
				projectId: item.projectId,
				customName: item.projectName,
			}));
			await printBatchService.sendToFarm({
				groupId,
				lessonDate,
				notes: notes.trim() !== '' ? notes : null,
				projectsToPrint,
			});
			toast.success('Paczka została wysłana na farmę druku!');
			setNotes('');
			onBatchSent(readyToPrint.map((item) => item.matrixKey));
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Błąd podczas wysyłania paczki.';
			toast.error(errorMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	// AKCJA 2: ODBIÓR PACZKI
	const handleConfirmDelivery = async () => {
		if (!readyBatch) return;
		setIsSubmitting(true);
		try {
			const confirmedIds = readyBatch.printJobs
				.filter((job) => job.status === PrintJobsStates.Printed && job.studentProjectId)
				.map((job) => job.studentProjectId as string);

			await printBatchService.confirmDelivery(readyBatch.id, { confirmedStudentProjectIds: confirmedIds });
			toast.success('Odebrano! Statusy zaktualizowane na Zrobione.');
			setReadyBatch(null);
			onBatchReceived();
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Błąd przy odbiorze paczki.';
			toast.error(errorMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	// AKCJA 3: ANULOWANIE PACZKI
	const handleCancelBatch = async (batchId: string) => {
		const isConfirmed = window.confirm(
			'Czy na pewno chcesz anulować tę paczkę? Modele powrócą na matrycę ze statusem "Do druku".',
		);
		if (!isConfirmed) return;

		try {
			await printBatchService.deleteBatch(batchId);
			toast.success('Paczka została anulowana.');
			setHistoryBatches((prev) => prev.filter((b) => b.id !== batchId));
			onBatchReceived();
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Błąd przy anulowaniu paczki.';
			toast.error(errorMessage);
		}
	};

	// POMOCNICZE TŁUMACZENIA STATUSÓW
	const getStatusBadge = (status: PrintBatchState) => {
		switch (status) {
			case PrintBatchState.Pending:
				return <span className="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">Wysłane</span>;
			case PrintBatchState.Printing:
				return <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">W druku</span>;
			case PrintBatchState.ReadyForCollection:
				return (
					<span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">Do odbioru</span>
				);
			case PrintBatchState.Completed:
				return (
					<span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">Zakończone</span>
				);
			default:
				return null;
		}
	};

	return (
		<div className="absolute top-0 right-0 bottom-0 z-40 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-[-10px_0_25px_rgba(0,0,0,0.1)] transition-all duration-300 sm:w-80">
			{/* ZAKŁADKI (TABS) */}
			<div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-2 pt-2">
				<div className="flex gap-2">
					<button
						onClick={() => setActiveTab('send')}
						className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'send' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
					>
						Aktywne zlecenia
					</button>
					<button
						onClick={() => setActiveTab('history')}
						className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
					>
						Historia
					</button>
				</div>
				<button onClick={onClose} className="mb-2 p-1 text-slate-400 transition-colors hover:text-slate-700">
					<XCircleFill size={22} />
				</button>
			</div>

			<div className="scrollbar-thin flex-1 overflow-y-auto bg-slate-50">
				{/* ===== ZAKŁADKA 1: WYSYŁKA / ODBIÓR ===== */}
				{activeTab === 'send' && (
					<div className="flex flex-col gap-4 p-4">
						{readyBatch && (
							<div className="rounded-xl border border-green-300 bg-green-50 p-4 shadow-sm">
								<h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-green-800">
									<BoxSeamFill /> Paczka do odbioru!
								</h3>
								<p className="mb-3 text-xs text-green-700">
									Wydruki z grupy gotowe. Potwierdź odbiór, aby oznaczyć pająki jako Zrobione.
								</p>
								<button
									onClick={handleConfirmDelivery}
									disabled={isSubmitting}
									className="w-full rounded-lg bg-green-600 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
								>
									{isSubmitting ? 'Odbieranie...' : 'Odbierz wydruki'}
								</button>
							</div>
						)}

						<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
							<h4 className="mb-3 flex items-center gap-2 font-bold text-purple-700">
								<PrinterFill /> Zleć nowe wydruki
							</h4>

							{!hasItemsToPrint ? (
								<p className="text-sm text-slate-400 italic">
									Zaznacz na matrycy status "Do druku" przy wybranych modelach.
								</p>
							) : (
								<div className="flex flex-col gap-3">
									{Object.entries(groupedToPrint).map(([studentName, projectList]) => (
										<div key={studentName} className="rounded-lg border border-purple-100 bg-purple-50 p-3">
											<div className="mb-2 text-sm font-extrabold text-purple-900">{studentName}</div>
											<div className="flex flex-wrap gap-1.5">
												{projectList.map((proj, idx) => (
													<span
														key={idx}
														className="rounded-md border border-purple-200 bg-white px-2 py-1 text-[10px] font-bold text-purple-700 shadow-sm"
													>
														{proj}
													</span>
												))}
											</div>
										</div>
									))}
									<textarea
										rows={2}
										className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
										placeholder="Uwagi dla farmy..."
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										disabled={isSubmitting}
									/>
									<button
										onClick={handleSendToFarm}
										disabled={isSubmitting}
										className="mt-2 w-full rounded-lg bg-purple-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
									>
										{isSubmitting ? 'Wysyłanie...' : 'Wyślij na farmę'}
									</button>
								</div>
							)}
						</div>
					</div>
				)}

				{/* ===== ZAKŁADKA 2: HISTORIA ===== */}
				{activeTab === 'history' && (
					<div className="flex flex-col gap-3 p-4">
						{isLoadingHistory ? (
							<p className="text-center text-sm text-slate-400">Ładowanie historii...</p>
						) : historyBatches.length === 0 ? (
							<p className="text-center text-sm text-slate-400">Ta grupa nie ma jeszcze historii wydruków.</p>
						) : (
							historyBatches.map((batch) => {
								// Grupowanie zleceń w locie (wewnątrz renderowania paczki)
								const groupedHistoryJobs = batch.printJobs.reduce(
									(acc, job) => {
										if (!acc[job.studentName]) acc[job.studentName] = [];
										acc[job.studentName].push(job.projectName);
										return acc;
									},
									{} as Record<string, string[]>,
								);

								return (
									<div key={batch.id} className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
										<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-3">
											<span className="text-xs font-bold text-slate-500">
												Zajęcia z: {new Date(batch.lessonDate).toLocaleDateString()}
											</span>
											{getStatusBadge(batch.status)}
										</div>
										<div className="p-3 text-sm">
											<p className="mb-2 font-bold text-slate-700">Zawartość ({batch.printJobs.length}):</p>

											{/* Wyświetlanie pogrupowanych modeli */}
											<div className="flex flex-col gap-2 text-xs text-slate-600">
												{Object.entries(groupedHistoryJobs).map(([studentName, projectNames]) => (
													<div
														key={studentName}
														className="flex flex-col rounded border border-slate-100 bg-slate-50 p-2"
													>
														<span className="mb-1 font-bold text-slate-700">{studentName}</span>
														<div className="flex flex-wrap gap-1">
															{projectNames.map((proj, idx) => (
																<span
																	key={idx}
																	className="rounded border border-purple-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-purple-700 shadow-sm"
																>
																	{proj}
																</span>
															))}
														</div>
													</div>
												))}
											</div>

											{/* OPCJA ANULOWANIA JEŚLI PACZKA JEST JESZCZE "PENDING" */}
											{batch.status === PrintBatchState.Pending && (
												<div className="mt-4 border-t border-slate-100 pt-3">
													<p className="mb-2 text-[10px] leading-tight text-slate-400">
														<InfoCircleFill className="mr-1 mb-0.5 inline" />
														Zapomniałeś o jakimś modelu? Anuluj tę paczkę, a modele wrócą na matrycę.
													</p>
													<button
														onClick={() => handleCancelBatch(batch.id)}
														className="w-full rounded border border-red-200 bg-red-50 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
													>
														Anuluj i popraw paczkę
													</button>
												</div>
											)}
										</div>
									</div>
								);
							})
						)}
					</div>
				)}
			</div>
		</div>
	);
};
