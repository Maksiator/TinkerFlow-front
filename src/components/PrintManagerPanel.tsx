import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PrinterFill, XCircleFill, BoxSeamFill, InfoCircleFill, PlusLg, Trash } from 'react-bootstrap-icons';
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

	// STANY DLA WYDRUKÓW NIESTANDARDOWYCH (CUSTOM)
	const [customText, setCustomText] = useState('');
	const [customJobs, setCustomJobs] = useState<{ id: string; studentId: string; customName: string }[]>([]);

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

	const hasItemsToPrint = readyToPrint.length > 0 || customJobs.length > 0;

	// FUNKCJA PARSUJĄCA TEKST NIESTANDARDOWYCH WYDRUKÓW
	const handleParseCustomText = (text: string) => {
		if (!text.trim()) return;
		const lines = text
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);

		const newCustomJobs = lines.map((line) => {
			// Szukamy separatorów typu: -, ,, (, ;, :, tab
			const separatorRegex = /[-,\(;:]/;
			const match = line.match(separatorRegex);

			let studentPart = line;
			let projectPart = '';

			if (match && match.index !== undefined) {
				studentPart = line.substring(0, match.index).trim();
				projectPart = line
					.substring(match.index + 1)
					.replace(/\)$/, '')
					.trim();
			}

			if (!projectPart) {
				projectPart = 'Projekt własny';
			}

			// Spróbuj dopasować studentPart do uczniów w grupie (tolerancja na kolejność imię/nazwisko)
			const matchedStudent = students.find((s) => {
				const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
				const reverseFullName = `${s.lastName} ${s.firstName}`.toLowerCase();
				const search = studentPart.toLowerCase();

				if (fullName.includes(search) || reverseFullName.includes(search)) return true;

				const hasFirstName = search.includes(s.firstName.toLowerCase());
				const hasLastName = search.includes(s.lastName.toLowerCase());
				if (hasFirstName && hasLastName) return true;

				return false;
			});

			return {
				id: Math.random().toString(36).substring(2, 9),
				studentId: matchedStudent ? matchedStudent.id : '',
				customName: projectPart,
			};
		});

		setCustomJobs((prev) => [...prev, ...newCustomJobs]);
		setCustomText('');
		toast.success(`Dodano ${newCustomJobs.length} pozycji.`);
	};

	// AKCJA 1: WYSYŁKA NOWEJ PACZKI
	const handleSendToFarm = async () => {
		if (!hasItemsToPrint) return;

		// Walidacja przypisania uczniów w customowych wydrukach
		const unassignedCustom = customJobs.some((j) => !j.studentId);
		if (unassignedCustom) {
			toast.error('Wybierz ucznia dla wszystkich wydruków niestandardowych!');
			return;
		}

		setIsSubmitting(true);
		try {
			const matrixProjects: PrintJobRequest[] = readyToPrint.map((item) => ({
				studentId: item.studentId,
				projectId: item.projectId,
				customName: item.projectName,
			}));

			const customProjects: PrintJobRequest[] = customJobs.map((item) => ({
				studentId: item.studentId,
				projectId: null,
				customName: item.customName.trim() || 'Projekt własny',
			}));

			const allProjectsToPrint = [...matrixProjects, ...customProjects];

			await printBatchService.sendToFarm({
				groupId,
				lessonDate,
				notes: notes.trim() !== '' ? notes : null,
				projectsToPrint: allProjectsToPrint,
			});
			toast.success('Paczka została wysłana na farmę druku!');
			setNotes('');
			setCustomJobs([]); // Wyczyść customowe wydruki
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

		// Znajdujemy anulowaną paczkę, aby móc wyciągnąć z niej wydruki niestandardowe
		const batchToCancel = historyBatches.find((b) => b.id === batchId);

		try {
			await printBatchService.deleteBatch(batchId);
			toast.success('Paczka została anulowana.');

			// Jeśli paczka miała wydruki niestandardowe, przywracamy je do formularza do ponownej edycji
			if (batchToCancel) {
				const customJobsFromCanceled = batchToCancel.printJobs
					.filter((job) => !job.studentProjectId)
					.map((job) => ({
						id: Math.random().toString(36).substring(2, 9),
						studentId: job.studentId,
						customName: job.projectName || 'Projekt własny',
					}));

				if (customJobsFromCanceled.length > 0) {
					setCustomJobs((prev) => [...prev, ...customJobsFromCanceled]);
					setActiveTab('send'); // Wracamy do zakładki edycji
					toast.success(`Przywrócono ${customJobsFromCanceled.length} wydruków niestandardowych do ponownej edycji.`);
				}
			}

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
									Wydruki z grupy gotowe. Potwierdź odbiór, aby oznaczyć projekty jako Zrobione.
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

							{/* 1. Wyświetlanie wydruków z matrycy (jeśli są) */}
							{readyToPrint.length > 0 && (
								<div className="mb-4 flex flex-col gap-3">
									<h5 className="text-xs font-extrabold tracking-wider text-slate-400 uppercase">
										Z matrycy ({readyToPrint.length})
									</h5>
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
								</div>
							)}

							{/* 2. Wyświetlanie wydruków niestandardowych (jeśli są) */}
							{customJobs.length > 0 && (
								<div className="mb-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4">
									<h5 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
										Wydruki niestandardowe ({customJobs.length})
									</h5>
									<div className="flex flex-col gap-2">
										{customJobs.map((job) => (
											<div
												key={job.id}
												className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm"
											>
												<select
													value={job.studentId}
													onChange={(e) => {
														const val = e.target.value;
														setCustomJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, studentId: val } : j)));
													}}
													className="min-w-0 flex-1 cursor-pointer rounded-md border border-slate-200 bg-white p-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-purple-500"
												>
													<option value="">-- Wybierz ucznia --</option>
													{students.map((s) => (
														<option key={s.id} value={s.id}>
															{s.lastName} {s.firstName}
														</option>
													))}
												</select>
												<input
													type="text"
													value={job.customName}
													onChange={(e) => {
														const val = e.target.value;
														setCustomJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, customName: val } : j)));
													}}
													placeholder="Nazwa projektu"
													className="w-24 shrink-0 rounded-md border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
												/>
												<button
													type="button"
													onClick={() => setCustomJobs((prev) => prev.filter((j) => j.id !== job.id))}
													className="shrink-0 text-slate-400 hover:text-red-500"
												>
													<Trash size={16} />
												</button>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Jeśli kompletnie nic nie ma wybranego/dodanego */}
							{readyToPrint.length === 0 && customJobs.length === 0 && (
								<p className="mb-4 text-xs text-slate-400 italic">
									Zaznacz na matrycy status "Do druku" przy wybranych modelach lub dodaj wydruki niestandardowe poniżej.
								</p>
							)}

							{/* 3. Panel wprowadzania i szybkiego dodawania wydruków niestandardowych (Zawsze dostępny!) */}
							<div className="mt-4 border-t border-slate-100 pt-4">
								<div className="mb-2 flex items-center justify-between">
									<span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
										Wydruk dodatkowy
									</span>
									<button
										type="button"
										onClick={() => {
											setCustomJobs((prev) => [
												...prev,
												{
													id: Math.random().toString(36).substring(2, 9),
													studentId: '',
													customName: 'Projekt własny',
												},
											]);
										}}
										className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700"
									>
										<PlusLg /> Wiersz
									</button>
								</div>

								<textarea
									rows={2}
									value={customText}
									onChange={(e) => setCustomText(e.target.value)}
									placeholder="Wpisz wydruki, np:&#10;Uczeń 1 - Brelok piesek&#10;Uczeń 2 - Kwiatek"
									className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
								/>
								<button
									type="button"
									onClick={() => handleParseCustomText(customText)}
									disabled={!customText.trim()}
									className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-900 disabled:opacity-40"
								>
									Przetwórz i dodaj
								</button>
							</div>

							{/* 4. Notatki i przycisk wysyłki (widoczne jeśli cokolwiek wysyłamy) */}
							{hasItemsToPrint && (
								<div className="mt-4 border-t border-slate-100 pt-4">
									<textarea
										rows={2}
										className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
										placeholder="Uwagi dla farmy..."
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										disabled={isSubmitting}
									/>
									<button
										onClick={handleSendToFarm}
										disabled={isSubmitting}
										className="mt-2.5 w-full rounded-lg bg-purple-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
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
