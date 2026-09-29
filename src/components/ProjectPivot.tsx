import { useState, useEffect, useMemo } from 'react';
import { Search, PrinterFill, BoxSeamFill, ClockHistory, ExclamationTriangleFill, InfoCircleFill, StarFill } from 'react-bootstrap-icons';
import { studentService, type Student } from '../api/studentService';
import { projectService, type Project, ProjectState, ProjectSoftware } from '../api/projectService';
import { studentProjectService } from '../api/studentProjectService';
import { GroupType } from '../api/groupService';
import { printBatchService } from '../api/printBatchService';
import { PrintLogDrawer } from './PrintLogDrawer';
import { MatrixSummaryPanel } from './MatrixSummaryPanel';
import { PrintManagerPanel } from './PrintManagerPanel'; // <--- NOWY IMPORT
import toast from 'react-hot-toast';

interface ProjectPivotProps {
	groupId: string;
	refreshTrigger?: number;
}

export function ProjectPivot({ groupId, refreshTrigger = 0 }: ProjectPivotProps) {
	const [students, setStudents] = useState<Student[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [groupType, setGroupType] = useState<GroupType>(GroupType.Standard);
	const [showAdvancedInStandard, setShowAdvancedInStandard] = useState(false);
	const [advancedSoftwareFilter, setAdvancedSoftwareFilter] = useState<'all' | 'sw' | 'tc_adv' | 'with_std'>('all');

	// STANY DLA PANELI BOCZNYCH
	const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Stare podsumowanie
	const [isPrintManagerOpen, setIsPrintManagerOpen] = useState(false); // NOWA SZUFLADA WYDRUKÓW
	const [isPrintLogOpen, setIsPrintLogOpen] = useState(false);
	const [showMissingBirthDateModal, setShowMissingBirthDateModal] = useState(false);

	const [matrixState, setMatrixState] = useState<Record<string, ProjectState>>({});
	const [localRefresh, setLocalRefresh] = useState(0);

	useEffect(() => {
		let isMounted = true;

		const fetchData = async () => {
			if (!groupId) return;

			try {
				const [fetchedStudents, fetchedProjects, fetchedMatrixTree, readyBatch] = await Promise.all([
					studentService.getByGroup(groupId),
					projectService.getAll(),
					studentProjectService.getForGroup(groupId),
					printBatchService.getReadyBatchForGroup(groupId).catch(() => null),
				]);

				if (!isMounted) return;

				if (fetchedMatrixTree && fetchedMatrixTree.groupType !== undefined) {
					setGroupType(fetchedMatrixTree.groupType);
				}

				const sortedStudents = fetchedStudents.sort((a, b) => {
					const lastNameCompare = a.lastName.localeCompare(b.lastName);
					if (lastNameCompare !== 0) return lastNameCompare;
					return a.firstName.localeCompare(b.firstName);
				});

				setStudents(sortedStudents);
				setProjects(fetchedProjects);

				const initialMatrixState: Record<string, ProjectState> = {};
				if (fetchedMatrixTree && fetchedMatrixTree.students) {
					fetchedMatrixTree.students.forEach((student) => {
						student.projects.forEach((project) => {
							initialMatrixState[`${student.studentId}_${project.projectId}`] = project.status;
						});
					});
				}

				setMatrixState(initialMatrixState);

				// Jeśli któryś uczeń w grupie standardowej ma już aktywny projekt zaawansowany Tinkercad -> rozwiń od razu
				const hasActiveAdvancedProject = fetchedProjects.some((p) => {
					if (p.isAdvanced && p.software !== ProjectSoftware.SolidWorks) {
						return Object.entries(initialMatrixState).some(
							([key, status]) => key.endsWith(`_${p.id}`) && status !== ProjectState.NotStarted,
						);
					}
					return false;
				});
				if (hasActiveAdvancedProject) {
					setShowAdvancedInStandard(true);
				}

				// Jeśli jest paczka do odbioru -> od razu otwieramy nowy panel wydruków!
				if (readyBatch) {
					setIsPrintManagerOpen(true);
				}

				// Jeśli w grupie są uczniowie bez daty urodzenia -> poinformuj trenera modala
				const missingBirthDates = sortedStudents.filter((s) => !s.dateOfBirth);
				if (missingBirthDates.length > 0) {
					setShowMissingBirthDateModal(true);
				}
			} catch (error) {
				if (isMounted) toast.error('Błąd pobierania danych do matrycy.');
				console.error(error);
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchData();

		return () => {
			isMounted = false;
		};
	}, [groupId, refreshTrigger, localRefresh]);

	const studentsWithoutBirthDate = useMemo(() => {
		return students.filter((s) => !s.dateOfBirth);
	}, [students]);

	const advancedTinkercadCount = useMemo(() => {
		return projects.filter((p) => (p.software === ProjectSoftware.Tinkercad || !p.software) && p.isAdvanced).length;
	}, [projects]);

	const filteredProjects = useMemo(() => {
		return projects.filter((p) => {
			const matchesSearch =
				p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				p.code.toLowerCase().includes(searchTerm.toLowerCase());
			if (!matchesSearch) return false;

			// Reguły dla grupy STANDARDOWEJ:
			if (groupType === GroupType.Standard) {
				// Grupy standardowe NIGDY nie widzą SolidWorks
				if (p.software === ProjectSoftware.SolidWorks) return false;

				// Tinkercad zaawansowany pokazywany tylko po kliknięciu toggle
				if (p.isAdvanced && !showAdvancedInStandard) return false;

				return true;
			}

			// Reguły dla grupy ZAAWANSOWANEJ:
			if (advancedSoftwareFilter === 'sw') {
				return p.software === ProjectSoftware.SolidWorks;
			}
			if (advancedSoftwareFilter === 'tc_adv') {
				return (p.software === ProjectSoftware.Tinkercad || !p.software) && !!p.isAdvanced;
			}
			if (advancedSoftwareFilter === 'with_std') {
				return true; // Pokaż wszystko włącznie z podstawowymi
			}
			// Domyślnie dla zaawansowanych: SolidWorks + Tinkercad ADV
			return p.isAdvanced || p.software === ProjectSoftware.SolidWorks;
		});
	}, [projects, searchTerm, groupType, showAdvancedInStandard, advancedSoftwareFilter]);

	const updateStatus = async (studentId: string, projectId: string, newStatus: ProjectState) => {
		const key = `${studentId}_${projectId}`;
		const previousStatus = matrixState[key];

		setMatrixState((prev) => ({ ...prev, [key]: newStatus }));

		try {
			await studentProjectService.upsert(studentId, projectId, newStatus);
		} catch (error) {
			setMatrixState((prev) => ({ ...prev, [key]: previousStatus || ProjectState.NotStarted }));
			toast.error('Nie udało się zapisać statusu do bazy.');
			console.error(error);
		}
	};

	const getStatusStyle = (status: ProjectState) => {
		switch (status) {
			case ProjectState.Scheduled:
				return 'bg-blue-50 border-blue-300 text-blue-700 font-bold';
			case ProjectState.InProgress:
				return 'bg-yellow-100 border-yellow-400 text-yellow-800 font-bold';
			case ProjectState.ReadyToPrint:
				return 'bg-purple-100 border-purple-400 text-purple-700 font-bold';
			case 5 as ProjectState:
				return 'bg-indigo-100 border-indigo-400 text-indigo-700 font-bold';
			case ProjectState.Completed:
				return 'bg-green-100 border-green-500 text-green-700 font-bold shadow-inner';
			case ProjectState.NotStarted:
			default:
				return 'bg-white border-slate-200 text-slate-400 font-normal hover:bg-slate-50 hover:border-slate-300';
		}
	};

	const scrollToProject = (projectId: string) => {
		const element = document.getElementById(`project-row-${projectId}`);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
			element.classList.add('bg-blue-100', 'transition-colors', 'duration-500');
			setTimeout(() => {
				element.classList.remove('bg-blue-100');
			}, 1500);
		}
	};

	const handleBatchSent = (sentMatrixKeys: string[]) => {
		setMatrixState((prev) => {
			const newState = { ...prev };
			sentMatrixKeys.forEach((key) => {
				newState[key] = 5 as ProjectState;
			});
			return newState;
		});
	};

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center bg-white shadow-sm md:rounded-xl md:border md:border-slate-200">
				<span className="font-bold text-slate-400">Synchronizacja matrycy z bazą...</span>
			</div>
		);
	}

	if (students.length === 0) {
		return (
			<div className="flex h-full items-center justify-center bg-white shadow-sm md:rounded-xl md:border md:border-slate-200">
				<div className="p-4 text-center">
					<span className="block text-lg font-bold text-slate-700 md:text-xl">Pusta Grupa</span>
					<span className="text-sm text-slate-400">W tej grupie nie ma jeszcze przypisanych uczniów.</span>
				</div>
			</div>
		);
	}

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-white md:rounded-xl md:border md:border-slate-200 md:shadow-sm">
			<div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between md:p-4">
				<div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-xs md:max-w-sm">
						<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
						<input
							type="text"
							placeholder="Szukaj projektu (np. Pająk)..."
							id="project-search-input"
							name="projectSearch"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full rounded-lg border border-slate-300 py-2 pr-4 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					{/* KONTROLKI PROFILU GRUPY (ZAAWANSOWANA VS STANDARDOWA) */}
					{groupType === GroupType.Advanced ? (
						<div className="flex flex-wrap items-center gap-1.5">
							<span className="flex items-center gap-1 rounded-lg bg-purple-100 border border-purple-200 px-2.5 py-1.5 text-xs font-black tracking-tight text-purple-900 shadow-2xs">
								<StarFill className="text-amber-500" size={13} /> Zaawansowana
							</span>
							<div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold shadow-2xs">
								{[
									{ id: 'all', label: 'Wszystkie ADV' },
									{ id: 'sw', label: 'SolidWorks' },
									{ id: 'tc_adv', label: 'Tinkercad ADV' },
									{ id: 'with_std', label: '+ Podstawowe' },
								].map((f) => (
									<button
										key={f.id}
										onClick={() => setAdvancedSoftwareFilter(f.id as any)}
										className={`cursor-pointer rounded-md px-2 py-1 transition-all ${
											advancedSoftwareFilter === f.id
												? 'bg-slate-800 text-white'
												: 'text-slate-600 hover:text-slate-900'
										}`}
									>
										{f.label}
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="flex items-center">
							<button
								type="button"
								onClick={() => setShowAdvancedInStandard(!showAdvancedInStandard)}
								className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all border ${
									showAdvancedInStandard
										? 'bg-purple-100 border-purple-300 text-purple-900 shadow-2xs'
										: 'bg-white border-slate-200 text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700'
								}`}
								title="Opcjonalne projekty Tinkercad spoza standardowego harmonogramu dla szybszych uczniów"
							>
								<StarFill className={showAdvancedInStandard ? 'text-amber-500' : 'text-slate-400'} size={12} />
								<span>
									{showAdvancedInStandard
										? 'Ukryj spoza harmonogramu'
										: `+ Spoza harmonogramu (${advancedTinkercadCount})`}
								</span>
							</button>
						</div>
					)}
				</div>

				{/* NOWE RESPONSYWNE PRZYCISKI Z UKRYWANYM TEKSTEM */}
				<div className="flex w-full items-center gap-2 md:w-auto">
					<button
						onClick={() => setIsSidebarOpen(!isSidebarOpen)}
						className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors md:flex-none md:px-4 md:text-sm ${isSidebarOpen ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
					>
						<BoxSeamFill />
						<span className="hidden sm:inline">Podsumowanie</span>
					</button>

					<button
						onClick={() => setIsPrintManagerOpen(!isPrintManagerOpen)}
						className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors md:flex-none md:px-4 md:text-sm ${isPrintManagerOpen ? 'bg-purple-200 text-purple-800' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
					>
						<PrinterFill />
						<span className="hidden sm:inline">Wydruki</span>
					</button>

					<button
						onClick={() => setIsPrintLogOpen(true)}
						className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 md:flex-none md:px-4 md:text-sm"
					>
						<ClockHistory />
						<span className="hidden md:inline">Logi zajęć</span>
					</button>
				</div>
			</div>

			{/* PASEK OSTRZEŻENIA DLA TRENERA O BRAKUJĄCYCH DATACH */}
			{studentsWithoutBirthDate.length > 0 && (
				<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
					<div className="flex items-center gap-2">
						<ExclamationTriangleFill className="text-amber-600 shrink-0" size={15} />
						<span>
							<strong className="text-amber-900 font-bold">Przypomnienie dla trenera:</strong> Brak daty urodzenia dla:{' '}
							<span className="font-bold underline decoration-amber-400">
								{studentsWithoutBirthDate.map((s) => `${s.firstName} ${s.lastName}`).join(', ')}
							</span>
							. Zapytaj na zajęciach o datę urodzenia!
						</span>
					</div>
					<button
						type="button"
						onClick={() => setShowMissingBirthDateModal(true)}
						className="cursor-pointer font-bold text-amber-800 hover:text-amber-950 underline text-xs ml-auto"
					>
						Szczegóły
					</button>
				</div>
			)}

			<div
				className={`scrollbar-thin relative min-h-0 flex-1 overflow-auto bg-white transition-all duration-300 ${
					isPrintManagerOpen || isSidebarOpen ? 'md:mr-80' : ''
				}`}
			>
				<table className="w-full min-w-max border-collapse text-left text-sm">
					<thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
						{/* ... Reszta kodu tabeli pozostaje bez zmian (to samo co miałeś) ... */}
						<tr>
							<th className="sticky left-0 z-30 w-24 min-w-22.5 border-r border-b border-slate-200 bg-slate-100 p-2 text-xs font-bold text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] md:w-auto md:min-w-50 md:p-4 md:text-sm">
								<span className="md:hidden">Projekty</span>
								<span className="hidden md:inline">Projekty ↓ \ Uczniowie →</span>
							</th>
							{students.map((student) => {
								const studentProjects = Object.entries(matrixState)
									.filter(([key]) => key.startsWith(`${student.id}_`))
									.map(([key, status]) => {
										const projectId = key.split('_')[1];
										return { projectId, status };
									});

								const firstScheduledId = studentProjects.find((p) => p.status === ProjectState.Scheduled)?.projectId;
								const firstInProgressId = studentProjects.find((p) => p.status === ProjectState.InProgress)?.projectId;
								const firstReadyToPrintId = studentProjects.find(
									(p) => p.status === ProjectState.ReadyToPrint,
								)?.projectId;

								const isBirthdayThisWeek = (dateOfBirth?: string | null) => {
									if (!dateOfBirth) return false;
									const today = new Date();
									const birthDate = new Date(dateOfBirth);
									if (isNaN(birthDate.getTime())) return false;
									
									const day = today.getDay() || 7;
									const startOfWeek = new Date(today);
									startOfWeek.setDate(today.getDate() - day + 1);
									startOfWeek.setHours(0, 0, 0, 0);
									
									const endOfWeek = new Date(startOfWeek);
									endOfWeek.setDate(startOfWeek.getDate() + 6);
									endOfWeek.setHours(23, 59, 59, 999);
									
									const yearsToCheck = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
									
									for (const year of yearsToCheck) {
										const birthThisYear = new Date(year, birthDate.getMonth(), birthDate.getDate());
										if (birthThisYear >= startOfWeek && birthThisYear <= endOfWeek) {
											return true;
										}
									}
									return false;
								};

								const hasBirthday = isBirthdayThisWeek(student.dateOfBirth);

								return (
									<th
										key={student.id}
										className="min-w-25 border-b border-slate-200 p-2 text-center align-top font-bold text-slate-700 md:min-w-40 md:p-4"
									>
										<div className="flex flex-col items-center gap-2">
											<span className="text-xs md:text-sm flex items-center justify-center gap-1.5 flex-wrap">
												<span>{student.lastName} {student.firstName}</span>
												{hasBirthday && (
													<div className="group relative flex items-center justify-center">
														<span className="cursor-help text-lg drop-shadow-sm">
															🎂
														</span>
														<div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-max -translate-x-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-xl">
															Urodziny: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('pl-PL') : ''}
															<div className="absolute bottom-full left-1/2 -mb-px -translate-x-1/2 border-4 border-transparent border-b-slate-800"></div>
														</div>
													</div>
												)}
												{!student.dateOfBirth && (
													<div className="group relative flex items-center justify-center">
														<span className="cursor-help text-sm animate-pulse" title="Brak daty urodzenia! Zapytaj ucznia.">
															⚠️
														</span>
														<div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-max max-w-xs -translate-x-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl text-center">
															Brak daty urodzenia!<br />Zapytaj ucznia na zajęciach.
															<div className="absolute bottom-full left-1/2 -mb-px -translate-x-1/2 border-4 border-transparent border-b-amber-900"></div>
														</div>
													</div>
												)}
											</span>
											<div className="flex h-2 w-full max-w-[80%] gap-1 overflow-hidden rounded-full bg-slate-200/50">
												{firstScheduledId && (
													<div
														onClick={() => scrollToProject(firstScheduledId)}
														className="h-full flex-1 cursor-pointer bg-blue-500 hover:bg-blue-600"
														title="Kliknij, by przejść do zaplanowanego"
													/>
												)}
												{firstInProgressId && (
													<div
														onClick={() => scrollToProject(firstInProgressId)}
														className="h-full flex-1 cursor-pointer bg-yellow-400 hover:bg-yellow-500"
														title="Kliknij, by przejść do projektu w trakcie"
													/>
												)}
												{firstReadyToPrintId && (
													<div
														onClick={() => scrollToProject(firstReadyToPrintId)}
														className="h-full flex-1 cursor-pointer bg-purple-500 hover:bg-purple-600"
														title="Kliknij, by przejść do wydruku"
													/>
												)}
											</div>
										</div>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{filteredProjects.map((project) => {
							const isSolidWorks = project.software === ProjectSoftware.SolidWorks;
							const isAdvancedProject = project.isAdvanced && !isSolidWorks;
							const isPractice = project.isPractice;
							const isYearEnd = project.isYearBoundary;

							// Kolory tła wiersza i komórki
							let rowBgClass = 'bg-white hover:bg-slate-50';
							let stickyBgClass = 'bg-white';
							if (isSolidWorks) {
								rowBgClass = 'bg-rose-50/20 hover:bg-rose-50/40';
							} else if (isAdvancedProject) {
								rowBgClass = 'bg-purple-50/20 hover:bg-purple-50/40';
							} else if (isPractice) {
								rowBgClass = 'bg-yellow-50 hover:bg-yellow-100/80';
								stickyBgClass = 'bg-yellow-50';
							}

							// Pionowy pasek akcentujący z lewej strony
							let borderLeftAccent = 'border-l-4 border-l-transparent';
							if (isSolidWorks) {
								borderLeftAccent = 'border-l-4 border-l-rose-500';
							} else if (isAdvancedProject) {
								borderLeftAccent = 'border-l-4 border-l-purple-500';
							}

							const borderBottomColClass = isYearEnd ? 'border-b-4 border-slate-900' : 'border-b border-slate-200';
							const borderStudentColClass = isYearEnd ? 'border-b-4 border-slate-900' : 'border-b border-slate-100';

							return (
								<tr key={project.id} id={`project-row-${project.id}`} className={`transition-colors ${rowBgClass}`}>
									<td
										className={`sticky left-0 z-10 border-r ${borderLeftAccent} ${borderBottomColClass} ${stickyBgClass} p-2 font-medium text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] md:p-3`}
									>
										<div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
											<div className="flex items-center gap-1.5 min-w-0">
												{isAdvancedProject && (
													<StarFill
														className="text-purple-500 shrink-0 cursor-help"
														size={11}
														title="Projekt spoza harmonogramu"
													/>
												)}
												<span
													className={`text-[10px] font-bold md:text-xs shrink-0 ${
														isSolidWorks
															? 'text-rose-600 font-extrabold'
															: isAdvancedProject
															? 'text-purple-600 font-extrabold'
															: 'text-blue-500'
													}`}
												>
													{project.code}
												</span>
												<span className="text-[11px] leading-tight md:text-sm">{project.name}</span>
											</div>
											<div className="flex items-center gap-1 shrink-0">
												{isSolidWorks && (
													<span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black tracking-tighter text-rose-700 uppercase">
														SW
													</span>
												)}
												{isPractice && (
													<span className="rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-black tracking-tighter text-yellow-800 uppercase">
														Łatwe
													</span>
												)}
											</div>
										</div>
									</td>

									{students.map((student) => {
										const key = `${student.id}_${project.id}`;
										const status = matrixState[key] || ProjectState.NotStarted;

										return (
											<td key={student.id} className={`${borderStudentColClass} p-1.5 text-center md:p-2`}>
												<select
													value={status}
													onChange={(e) => updateStatus(student.id, project.id, Number(e.target.value) as ProjectState)}
													className={`mx-auto w-full max-w-30 cursor-pointer rounded-md border px-1 py-1.5 text-[10px] transition-all outline-none focus:ring-2 focus:ring-blue-400 md:px-2 md:text-xs ${getStatusStyle(status)}`}
												>
													<option value={ProjectState.NotStarted} className="bg-white text-slate-700">
														Brak
													</option>
													<option value={ProjectState.Scheduled} className="bg-white text-slate-700">
														W planach
													</option>
													<option value={ProjectState.InProgress} className="bg-white text-slate-700">
														W trakcie
													</option>
													<option value={ProjectState.ReadyToPrint} className="bg-white text-slate-700">
														Do druku
													</option>
													<option value={5 as ProjectState} className="bg-white text-slate-700" disabled>
														Wysłano do druku
													</option>
													<option value={ProjectState.Completed} className="bg-white text-slate-700">
														Zrobione
													</option>
												</select>
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* STARE PODSUMOWANIE (Teraz tylko statystyki/obecności, możesz tu wyciąć logikę druku) */}
			{isSidebarOpen && (
				<MatrixSummaryPanel
					matrixState={matrixState}
					students={students}
					projects={projects}
					onClose={() => setIsSidebarOpen(false)}
				/>
			)}

			{/* NOWY PANEL ZAKŁADEK (WYDRUKI) */}
			{isPrintManagerOpen && (
				<PrintManagerPanel
					groupId={groupId}
					lessonDate={new Date().toISOString()}
					matrixState={matrixState}
					students={students}
					projects={projects}
					onBatchSent={handleBatchSent}
					onBatchReceived={() => setLocalRefresh((prev) => prev + 1)}
					onClose={() => setIsPrintManagerOpen(false)}
				/>
			)}

			<PrintLogDrawer groupId={groupId} isOpen={isPrintLogOpen} onClose={() => setIsPrintLogOpen(false)} />

			{/* MODAL INFORMACYJNY DLA TRENERA O BRAKUJĄCYCH DATACH URODZENIA */}
			{showMissingBirthDateModal && studentsWithoutBirthDate.length > 0 && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
					<div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-amber-200 animate-scale-up">
						<div className="flex items-center gap-3 text-amber-600 mb-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 shrink-0">
								<ExclamationTriangleFill size={26} />
							</div>
							<div>
								<h3 className="text-lg font-bold text-slate-900">Brakujące daty urodzenia!</h3>
								<p className="text-xs text-slate-500">Ważny monit dla prowadzącego zajęcia</p>
							</div>
						</div>

						<p className="text-sm text-slate-600 mb-3 leading-relaxed">
							W tej grupie następujący uczniowie nie mają uzupełnionej daty urodzenia:
						</p>

						<div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
							{studentsWithoutBirthDate.map((s) => (
								<div key={s.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-amber-200/60 shadow-2xs">
									<span className="font-bold text-slate-800 text-sm">
										👤 {s.firstName} {s.lastName}
									</span>
									<span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
										Brak daty
									</span>
								</div>
							))}
						</div>

						<div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-900 mb-5 flex items-start gap-2.5">
							<InfoCircleFill className="text-blue-600 shrink-0 mt-0.5" size={16} />
							<span>
								<strong>Zadanie trenera:</strong> Zapytaj powyższych uczniów na zajęciach o dokładną datę urodzenia i przekaż ją swojemu koordynatorowi, aby uzupełnił profil ucznia w systemie.
							</span>
						</div>

						<button
							type="button"
							onClick={() => setShowMissingBirthDateModal(false)}
							className="w-full cursor-pointer rounded-xl bg-amber-500 py-3 text-center text-sm font-bold text-white shadow-md hover:bg-amber-600 transition-colors"
						>
							Rozumiem, zapytam na zajęciach
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
