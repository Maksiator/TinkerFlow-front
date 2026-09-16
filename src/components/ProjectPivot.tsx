import { useState, useEffect } from 'react';
import { Search, PrinterFill, BoxSeamFill, ClockHistory } from 'react-bootstrap-icons';
import { studentService, type Student } from '../api/studentService';
import { projectService, type Project, ProjectState } from '../api/projectService';
import { studentProjectService } from '../api/studentProjectService';
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

	// STANY DLA PANELI BOCZNYCH
	const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Stare podsumowanie
	const [isPrintManagerOpen, setIsPrintManagerOpen] = useState(false); // NOWA SZUFLADA WYDRUKÓW
	const [isPrintLogOpen, setIsPrintLogOpen] = useState(false);

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

				// Jeśli jest paczka do odbioru -> od razu otwieramy nowy panel wydruków!
				if (readyBatch) {
					setIsPrintManagerOpen(true);
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

	const filteredProjects = projects.filter(
		(p) =>
			p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			p.code.toLowerCase().includes(searchTerm.toLowerCase()),
	);

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
				<div className="relative w-full md:max-w-md">
					<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Szukaj projektu (np. Pająk)..."
						id="project-search-input"
						name="projectSearch"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full rounded-lg border border-slate-300 py-2.5 pr-4 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 md:py-2"
					/>
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

								const isBirthdayThisWeek = (dateOfBirth: string) => {
									if (!dateOfBirth) return false;
									const today = new Date();
									const birthDate = new Date(dateOfBirth);
									
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
											<span className="text-xs md:text-sm flex items-center justify-center gap-1">
												{student.lastName} {student.firstName}
												{hasBirthday && (
													<div className="group relative flex items-center justify-center">
														<span className="cursor-help text-lg drop-shadow-sm">
															🎂
														</span>
														<div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-max -translate-x-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-xl">
															Urodziny: {new Date(student.dateOfBirth).toLocaleDateString('pl-PL')}
															<div className="absolute bottom-full left-1/2 -mb-px -translate-x-1/2 border-4 border-transparent border-b-slate-800"></div>
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
							const isPractice = project.isPractice;
							const isYearEnd = project.isYearBoundary;
							const rowBgClass = isPractice ? 'bg-yellow-50 hover:bg-yellow-100/80' : 'bg-white hover:bg-slate-50';
							const stickyBgClass = isPractice ? 'bg-yellow-50' : 'bg-white';
							const borderLeftColClass = isYearEnd ? 'border-b-4 border-slate-900' : 'border-b border-slate-200';
							const borderStudentColClass = isYearEnd ? 'border-b-4 border-slate-900' : 'border-b border-slate-100';

							return (
								<tr key={project.id} id={`project-row-${project.id}`} className={`transition-colors ${rowBgClass}`}>
									<td
										className={`sticky left-0 z-10 border-r ${borderLeftColClass} ${stickyBgClass} p-2 font-medium text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] md:p-4`}
									>
										<div className="flex flex-col md:flex-row md:items-center">
											<div className="flex items-center">
												<span className="mr-1.5 text-[10px] font-bold text-blue-500 md:mr-2 md:text-xs">
													{project.code}
												</span>
												<span className="text-[11px] leading-tight md:text-sm">{project.name}</span>
											</div>
											{isPractice && (
												<span className="mt-1 self-start rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-black tracking-tighter text-yellow-800 uppercase md:mt-0 md:ml-2 md:self-auto">
													Łatwe
												</span>
											)}
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
		</div>
	);
}
