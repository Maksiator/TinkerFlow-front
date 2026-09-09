import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PrinterFill, XCircleFill, BoxSeamFill, InfoCircleFill, PlusLg, Trash, SlashCircle } from 'react-bootstrap-icons';
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
	const [customJobs, setCustomJobs] = useState<{ id: string; studentId: string; customName: string }[]>(() => {
		try {
			const saved = localStorage.getItem(`custom_jobs_${groupId}`);
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});

	// AUTO-ZAPIS WYDRUKÓW NIESTANDARDOWYCH W LOCAL STORAGE
	useEffect(() => {
		localStorage.setItem(`custom_jobs_${groupId}`, JSON.stringify(customJobs));
	}, [customJobs, groupId]);

	// STANY DLA BRAKU WYDRUKÓW NA ZAJĘCIACH
	const [selectedNoPrintReason, setSelectedNoPrintReason] = useState<string>('');
	const [isCustomNoPrintReason, setIsCustomNoPrintReason] = useState(false);
	const [customNoPrintReason, setCustomNoPrintReason] = useState('');
	const [noPrintNotes, setNoPrintNotes] = useState('');

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

	// POBIERANIE HISTORII (Na start grupy i przy zmianie zakładki)
	useEffect(() => {
		let isMounted = true;
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
		return () => {
			isMounted = false;
		};
	}, [groupId]);

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

	const combinedToPrint = useMemo(() => {
		const result: Record<string, { name: string; isCustom: boolean }[]> = {};

		// 1. Dodajemy projekty z matrycy
		readyToPrint.forEach((item) => {
			if (!result[item.studentName]) {
				result[item.studentName] = [];
			}
			result[item.studentName].push({
				name: item.projectName,
				isCustom: false,
			});
		});

		// 2. Dodajemy projekty customowe (tylko te, które mają wybranego ucznia!)
		customJobs.forEach((job) => {
			if (job.studentId) {
				const student = students.find((s) => s.id === job.studentId);
				if (student) {
					const studentName = `${student.firstName} ${student.lastName}`;
					if (!result[studentName]) {
						result[studentName] = [];
					}
					result[studentName].push({
						name: job.customName || 'Projekt własny',
						isCustom: true,
					});
				}
			}
		});

		// Sortujemy klucze alfabetycznie
		return Object.keys(result)
			.sort()
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {} as Record<string, { name: string; isCustom: boolean }[]>);
	}, [readyToPrint, customJobs, students]);

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

	// AKCJA 4: ZGŁOSZENIE BRAKU WYDRUKÓW NA ZAJĘCIACH
	const handleReportNoPrints = async () => {
		const finalReason = isCustomNoPrintReason ? customNoPrintReason.trim() : selectedNoPrintReason.trim();
		if (!finalReason) {
			toast.error('Wybierz lub wpisz powód braku wydruków.');
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await printBatchService.reportNoPrints({
				groupId,
				lessonDate,
				reason: finalReason,
				additionalNotes: noPrintNotes.trim() ? noPrintNotes.trim() : undefined,
			});

			toast.success(res.message || 'Poinformowano drukarza o braku projektów.');
			setSelectedNoPrintReason('');
			setIsCustomNoPrintReason(false);
			setCustomNoPrintReason('');
			setNoPrintNotes('');

			// Odśwież historię paczek
			const updatedHistory = await printBatchService.getBatchHistoryForGroup(groupId);
			setHistoryBatches(updatedHistory);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Błąd podczas zgłaszania.';
			toast.error(errorMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Weryfikacja czy dla dzisiejszej daty zgłoszono brak wydruków
	const todayLessonDateStr = new Date(lessonDate).toISOString().split('T')[0];
	const todayNoPrintsBatch = historyBatches.find(
		(b) => b.status === PrintBatchState.NoPrints && new Date(b.lessonDate).toISOString().split('T')[0] === todayLessonDateStr
	);

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
			case PrintBatchState.NoPrints:
				return (
					<span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
						<SlashCircle size={10} /> Brak wydruków
					</span>
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

							{/* 1. Podsumowanie zawartości paczki (Z matrycy + Niestandardowe) */}
							{Object.keys(combinedToPrint).length > 0 && (
								<div className="mb-4 flex flex-col gap-3">
									<div className="flex items-center justify-between">
										<h5 className="text-xs font-extrabold tracking-wider text-slate-400 uppercase">
											Zawartość paczki ({Object.values(combinedToPrint).flat().length} modeli)
										</h5>
										{/* Mini legenda */}
										<div className="flex items-center gap-2 text-[9px] font-bold text-slate-450 uppercase tracking-wider">
											<span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span> Matryca</span>
											<span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-orange-500"></span> Własny</span>
										</div>
									</div>
									{Object.entries(combinedToPrint).map(([studentName, projectList]) => (
										<div key={studentName} className="rounded-lg border border-purple-100 bg-purple-50/50 p-3 shadow-sm">
											<div className="mb-2 flex items-center justify-between">
												<span className="text-sm font-extrabold text-purple-900">{studentName}</span>
												<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700">
													{projectList.length} szt.
												</span>
											</div>
											<div className="flex flex-wrap gap-1.5">
												{projectList.map((proj, idx) => (
													<span
														key={idx}
														className={`rounded-md border px-2 py-1 text-[10px] font-bold shadow-sm ${
															proj.isCustom 
																? 'border-orange-200 bg-orange-50 text-orange-700' 
																: 'border-purple-200 bg-white text-purple-700'
														}`}
													>
														{proj.name}
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

							{/* Jeśli dzisiaj zgłoszono brak wydruków */}
							{todayNoPrintsBatch && (
								<div className="mb-4 rounded-xl border border-slate-200 bg-slate-100/90 p-3.5 text-xs shadow-xs">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 font-bold text-slate-700">
											<SlashCircle className="text-slate-500" size={15} />
											<span>Brak wydruków na zajęciach</span>
										</div>
										<button
											type="button"
											onClick={() => handleCancelBatch(todayNoPrintsBatch.id)}
											className="cursor-pointer font-bold text-rose-600 hover:text-rose-700 text-[11px] underline"
										>
											Anuluj
										</button>
									</div>
									<p className="mt-1 text-[11px] text-slate-500">
										Drukarz wie, aby nie czekać na tę grupę.{todayNoPrintsBatch.notes ? ` (${todayNoPrintsBatch.notes})` : ''}
									</p>
								</div>
							)}

							{/* Jeśli kompletnie nic nie ma wybranego/dodanego */}
							{!hasItemsToPrint && !todayNoPrintsBatch && (
								<div className="mb-4 space-y-3">
									<p className="text-xs text-slate-400 italic">
										Zaznacz na matrycy status "Do druku" przy wybranych modelach lub dodaj wydruki niestandardowe poniżej.
									</p>

									{/* Subtelna sekcja zgłoszenia braku wydruków */}
									<div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 text-xs shadow-xs">
										<div className="flex items-center gap-1.5 font-bold text-amber-900">
											<SlashCircle className="text-amber-600" size={14} />
											<span>Brak projektów na dzisiejszych zajęciach?</span>
										</div>
										<p className="mt-1 text-[11px] text-amber-800/80">
											Poinformuj drukarza, aby nie czekał ze startem farmy na tę grupę.
										</p>

										<div className="mt-2.5 flex flex-wrap gap-1.5">
											{[
												{ label: 'Okulary VR', icon: '🥽' },
												{ label: 'Długopisy 3D', icon: '🖊️' },
												{ label: 'Robotyka', icon: '🤖' },
												{ label: 'Teoria / Inne', icon: '🧩' },
											].map((p) => (
												<button
													key={p.label}
													type="button"
													onClick={() => {
														setSelectedNoPrintReason(p.label);
														setIsCustomNoPrintReason(false);
													}}
													className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
														selectedNoPrintReason === p.label && !isCustomNoPrintReason
															? 'bg-amber-600 text-white shadow-xs'
															: 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-100/70'
													}`}
												>
													{p.icon} {p.label}
												</button>
											))}
											<button
												type="button"
												onClick={() => {
													setIsCustomNoPrintReason(true);
													setSelectedNoPrintReason('');
												}}
												className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
													isCustomNoPrintReason
														? 'bg-amber-600 text-white shadow-xs'
														: 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-100/70'
												}`}
											>
												✏️ Inny...
											</button>
										</div>

										{(selectedNoPrintReason || isCustomNoPrintReason) && (
											<div className="mt-2.5 space-y-2 animate-in fade-in duration-150">
												{isCustomNoPrintReason && (
													<input
														type="text"
														placeholder="Wpisz powód (np. Turniej, Dzień otwarty)..."
														value={customNoPrintReason}
														onChange={(e) => setCustomNoPrintReason(e.target.value)}
														className="w-full rounded-md border border-amber-300 bg-white p-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
													/>
												)}
												<input
													type="text"
													placeholder="Dodatkowa notatka (opcjonalnie)..."
													value={noPrintNotes}
													onChange={(e) => setNoPrintNotes(e.target.value)}
													className="w-full rounded-md border border-amber-200 bg-white p-1.5 text-[11px] text-slate-700 outline-none focus:border-amber-500"
												/>
												<button
													type="button"
													onClick={handleReportNoPrints}
													disabled={isSubmitting || (isCustomNoPrintReason && !customNoPrintReason.trim())}
													className="w-full cursor-pointer rounded-lg bg-amber-700 hover:bg-amber-800 py-1.5 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50"
												>
													{isSubmitting ? 'Zgłaszanie...' : 'Poinformuj drukarza o braku wydruków'}
												</button>
											</div>
										)}
									</div>
								</div>
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
								if (batch.status === PrintBatchState.NoPrints) {
									return (
										<div key={batch.id} className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
											<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-3">
												<span className="text-xs font-bold text-slate-500">
													Zajęcia z: {new Date(batch.lessonDate).toLocaleDateString()}
												</span>
												{getStatusBadge(batch.status)}
											</div>
											<div className="p-3 text-xs text-slate-600 space-y-2">
												<div className="flex items-center gap-1.5 font-bold text-slate-800">
													<SlashCircle className="text-slate-500" size={13} />
													<span>Brak wydruków na farmę</span>
												</div>
												{batch.notes && (
													<p className="rounded-lg bg-slate-50 p-2 text-slate-700 border border-slate-100 text-xs font-medium">
														Powód: <strong className="text-slate-900">{batch.notes}</strong>
													</p>
												)}
												<div className="border-t border-slate-100 pt-2">
													<button
														type="button"
														onClick={() => handleCancelBatch(batch.id)}
														className="w-full cursor-pointer rounded-lg border border-red-200 bg-red-50 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
													>
														Usuń wpis
													</button>
												</div>
											</div>
										</div>
									);
								}

								// Grupowanie zleceń w locie (wewnątrz renderowania paczki)
								const groupedHistoryJobs = batch.printJobs.reduce(
									(acc, job) => {
										if (!acc[job.studentName]) acc[job.studentName] = [];
										acc[job.studentName].push({
											name: job.projectName,
											isCustom: !job.studentProjectId,
										});
										return acc;
									},
									{} as Record<string, { name: string; isCustom: boolean }[]>,
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
											<div className="mb-2 flex items-center justify-between">
												<span className="font-bold text-slate-700">Zawartość ({batch.printJobs.length})</span>
												{/* Mini legenda */}
												<div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
													<span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-purple-500"></span> Matryca</span>
													<span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-orange-500"></span> Własny</span>
												</div>
											</div>

											{/* Wyświetlanie pogrupowanych modeli */}
											<div className="flex flex-col gap-2 text-xs text-slate-600">
												{Object.entries(groupedHistoryJobs).map(([studentName, projectList]) => (
													<div
														key={studentName}
														className="flex flex-col rounded border border-slate-100 bg-slate-50 p-2"
													>
														<span className="mb-1 font-bold text-slate-700">{studentName}</span>
														<div className="flex flex-wrap gap-1">
															{projectList.map((proj, idx) => (
																<span
																	key={idx}
																	className={`rounded border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${
																		proj.isCustom 
																			? 'border-orange-200 bg-orange-50 text-orange-700' 
																			: 'border-purple-100 bg-white text-purple-700'
																	}`}
																>
																	{proj.name}
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
