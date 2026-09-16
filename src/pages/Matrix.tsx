import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectPivot } from '../components/ProjectPivot';
import { ArrowLeft, ArrowRight, CheckLg, XLg, Tools } from 'react-bootstrap-icons';
import { studentProjectService } from '../api/studentProjectService';
import { projectService, ProjectState } from '../api/projectService';
import { groupService } from '../api/groupService';
import toast from 'react-hot-toast';

interface GroupData {
	id: string;
	name: string;
	location: string;
	isFavorite: boolean;
}

interface SummaryProjectGroup {
	groupId: string;
	groupName: string;
	studentsScheduled: string[];
	studentsInProgress: string[];
	qty: number;
}

interface SummaryProject {
	id: string;
	name: string;
	groups: SummaryProjectGroup[];
	totalQty: number;
}

export function Matrix() {
	const navigate = useNavigate();

	const [searchParams, setSearchParams] = useSearchParams();
	const groupsParam = searchParams.get('groups');
	const activeParam = searchParams.get('active');

	const [selectedGroups, setSelectedGroups] = useState<GroupData[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
	const [showSummaryModal, setShowSummaryModal] = useState(false);
	const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});

	const [globalSummary, setGlobalSummary] = useState<SummaryProject[]>([]);

	const [refreshTrigger] = useState(0);



	useEffect(() => {
		let isMounted = true;

		const fetchGroupsData = async () => {
			if (!groupsParam) {
				setIsLoading(false);
				return;
			}

			try {
				const requestedIds = groupsParam.split(',');
				const allGroups = await groupService.getAll();

				if (isMounted) {
					const mappedGroups = requestedIds
						.map((id) => {
							const found = allGroups.find((g) => g.id === id);
							return found
								? {
										id: found.id,
										name: found.name,
										location: found.branchName || 'Brak lokalizacji',
										isFavorite: false,
									}
								: null;
						})
						.filter(Boolean) as GroupData[];

					setSelectedGroups(mappedGroups);

					if (!activeParam && mappedGroups.length > 0) {
						searchParams.set('active', mappedGroups[0].id);
						setSearchParams(searchParams, { replace: true });
					}
				}
			} catch (error) {
				console.error('Błąd pobierania danych grup:', error);
				if (isMounted) toast.error('Nie udało się załadować danych o grupach.');
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchGroupsData();

		return () => {
			isMounted = false;
		};
	}, [groupsParam, activeParam, searchParams, setSearchParams]);

	const currentIndex = useMemo(() => {
		const idx = selectedGroups.findIndex((g) => g.id === activeParam);
		return idx !== -1 ? idx : 0;
	}, [selectedGroups, activeParam]);

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center p-10 font-bold text-slate-400">
				Ładowanie danych matrycy...
			</div>
		);
	}

	if (selectedGroups.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-center md:p-10">
				<div>
					<h2 className="mb-4 text-xl font-bold text-red-600 md:text-2xl">Nie znaleziono grup!</h2>
					<p className="mb-6 text-sm text-slate-500 md:text-base">Prawdopodobnie użyłeś nieprawidłowego linku.</p>
					<button
						onClick={() => navigate('/matryca')}
						className="cursor-pointer rounded-md bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-700"
					>
						Wróć do głównego panelu
					</button>
				</div>
			</div>
		);
	}

	const currentGroup = selectedGroups[currentIndex];
	const isFirstStep = currentIndex === 0;
	const isLastStep = currentIndex === selectedGroups.length - 1;

	const handleNext = () => {
		if (!isLastStep) {
			searchParams.set('active', selectedGroups[currentIndex + 1].id);
			setSearchParams(searchParams);
		}
	};

	const handlePrev = () => {
		if (!isFirstStep) {
			searchParams.set('active', selectedGroups[currentIndex - 1].id);
			setSearchParams(searchParams);
		}
	};

	const handleFinish = async () => {
		setIsGeneratingSummary(true);
		setPackedItems({});

		try {
			const allProjects = await projectService.getAll();
			const trees = await studentProjectService.getForGroupsBulk(selectedGroups.map(g => g.id));

			const projectMap: Record<string, SummaryProject> = {};

			trees.forEach((tree) => {
				if (tree && tree.students) {
					// Szukamy nazwy grupy dla tego drzewa
					const groupInfo = selectedGroups.find(g => g.id === tree.groupId);
					const groupName = groupInfo ? groupInfo.name : 'Nieznana grupa';

					tree.students.forEach((s) => {
						const studentName = s.fullName;

						s.projects.forEach((p) => {
							if (p.status === ProjectState.Scheduled || p.status === ProjectState.InProgress) {
								if (!projectMap[p.projectId]) {
									const projInfo = allProjects.find((x) => x.id === p.projectId);
									projectMap[p.projectId] = {
										id: p.projectId,
										name: projInfo ? `${projInfo.name} (${projInfo.code})` : 'Nieznany projekt',
										groups: [],
										totalQty: 0,
									};
								}

								const proj = projectMap[p.projectId];
								let pg = proj.groups.find(g => g.groupId === tree.groupId);
								if (!pg) {
									pg = {
										groupId: tree.groupId,
										groupName: groupName,
										studentsScheduled: [],
										studentsInProgress: [],
										qty: 0
									};
									proj.groups.push(pg);
								}

								if (p.status === ProjectState.Scheduled) {
									pg.studentsScheduled.push(studentName);
								} else if (p.status === ProjectState.InProgress) {
									pg.studentsInProgress.push(studentName);
								}

								pg.qty += 1;
							}
						});
					});
				}
			});

			// Obliczamy totalQty jako MAKSYMALNĄ ilość wymaganą przez pojedynczą grupę
			Object.values(projectMap).forEach((proj) => {
				proj.totalQty = proj.groups.reduce((max, g) => Math.max(max, g.qty), 0);
			});

			const sortedSummary = Object.values(projectMap).sort((a, b) => a.name.localeCompare(b.name));

			setGlobalSummary(sortedSummary);
			setShowSummaryModal(true);
		} catch (error) {
			toast.error('Błąd podczas generowania podsumowania.');
			console.error(error);
		} finally {
			setIsGeneratingSummary(false);
		}
	};

	const togglePacked = (id: string) => {
		setPackedItems((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const renderSummaryProject = (item: SummaryProject) => {
		const isChecked = packedItems[item.id];

		return (
			<div
				key={item.id}
				className={`flex items-center justify-between rounded-xl border-2 p-4 transition-all ${
					isChecked ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-blue-200 bg-blue-50 shadow-sm'
				}`}
			>
				<div className="flex cursor-pointer items-center gap-4 flex-1" onClick={() => togglePacked(item.id)}>
					<div
						className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
							isChecked ? 'border-slate-400 bg-slate-400' : 'border-blue-500 bg-white'
						}`}
					>
						{isChecked && <CheckLg className="text-white" />}
					</div>
					<span
						className={`text-base font-bold sm:text-lg ${isChecked ? 'text-slate-500 line-through' : 'text-slate-800'}`}
					>
						{item.name}
					</span>
				</div>
				<span
					className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
						isChecked ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white shadow-sm'
					}`}
				>
					{item.totalQty} szt.
				</span>
			</div>
		);
	};

	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
			{/* ZWIEZŁY, KOMPAKTOWY NAGŁÓWEK DLA LEPSZEGO SKALOWANIA NA LAPTOPACH */}
			<div className="z-10 shrink-0 border-b border-slate-200 bg-white px-3 py-2 shadow-xs md:px-6 md:py-2.5">
				<div className="mx-auto flex max-w-400 items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-2 md:gap-3">
						<span className="shrink-0 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-orange-700 md:text-xs">
							Krok {currentIndex + 1}/{selectedGroups.length}
						</span>
						<h1 className="truncate text-base font-extrabold text-slate-800 md:text-xl" title={currentGroup.name}>
							{currentGroup.name}
						</h1>
						<span className="hidden text-slate-300 sm:inline">•</span>
						<p className="hidden truncate text-xs text-slate-500 sm:inline" title={currentGroup.location}>
							{currentGroup.location}
						</p>
					</div>

					{/* KLIKALNE KROPKI PAGINACJI (BULLETY) */}
					<div className="flex shrink-0 items-center gap-0.5 overflow-x-auto scrollbar-none py-1">
						{selectedGroups.map((group, idx) => {
							const isCurrent = idx === currentIndex;
							const isPast = idx < currentIndex;
							return (
								<button
									key={group.id}
									type="button"
									onClick={() => {
										searchParams.set('active', group.id);
										setSearchParams(searchParams);
									}}
									title={`Przejdź do: ${idx + 1}. ${group.name} (${group.location})`}
									className="group flex h-6 w-6 cursor-pointer items-center justify-center rounded-full focus:outline-none"
								>
									<span
										className={`rounded-full transition-all duration-150 ${
											isCurrent
												? 'h-3.5 w-3.5 bg-blue-600 ring-2 ring-blue-400 ring-offset-1'
												: isPast
												? 'h-2 w-2 bg-blue-300 group-hover:h-3 group-hover:w-3 group-hover:bg-blue-500'
												: 'h-2 w-2 bg-slate-300 group-hover:h-3 group-hover:w-3 group-hover:bg-slate-400'
										}`}
									/>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* GŁÓWNY OBSZAR TABELI Z WIĘKSZĄ PRZESTRZENIĄ PIONOWĄ NA LAPTOPACH */}
			<div className="mx-auto flex w-full max-w-400 flex-1 flex-col overflow-hidden p-0 md:px-6 md:py-2">
				<ProjectPivot key={currentGroup.id} groupId={currentGroup.id} refreshTrigger={refreshTrigger} />
			</div>

			<div className="z-10 shrink-0 border-t border-slate-200 bg-white p-3 md:p-4">
				<div className="mx-auto flex max-w-400 justify-between gap-2">
					<button
						onClick={handlePrev}
						disabled={isFirstStep}
						className={`flex items-center justify-center gap-1 rounded-lg px-4 py-3 text-sm font-bold transition-colors md:gap-2 md:px-6 md:py-2 md:text-base ${isFirstStep ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-100'}`}
					>
						<ArrowLeft /> Wstecz
					</button>

					{isLastStep ? (
						<button
							onClick={handleFinish}
							disabled={isGeneratingSummary}
							className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-green-700 disabled:bg-slate-400 md:flex-none md:gap-2 md:px-8 md:py-2 md:text-base"
						>
							{isGeneratingSummary ? (
								'Przeliczanie...'
							) : (
								<>
									<span className="hidden sm:inline">Generuj listę pakowania</span>
									<span className="sm:hidden">Spakuj</span>
								</>
							)}{' '}
							<CheckLg />
						</button>
					) : (
						<button
							onClick={handleNext}
							className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700 md:flex-none md:gap-2 md:px-8 md:py-2 md:text-base"
						>
							Dalej <ArrowRight />
						</button>
					)}
				</div>
			</div>

			{showSummaryModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
						<div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50 p-4 md:p-6">
							<div className="flex items-center gap-3 text-slate-800">
								<h2 className="text-xl font-bold md:text-2xl">Spakuj do torby</h2>
							</div>
							<button
								onClick={() => setShowSummaryModal(false)}
								className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200"
							>
								<XLg />
							</button>
						</div>

						<div className="scrollbar-thin flex flex-1 flex-col gap-8 overflow-y-auto p-4 md:p-6">
							<div>
								<div className="mb-4 flex items-center gap-2 text-blue-700">
									<Tools size={22} />
									<h3 className="text-lg font-bold md:text-xl">Zapotrzebowanie na projekty</h3>
								</div>
								{globalSummary.length === 0 ? (
									<div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-slate-400">
										Nie masz zaplanowanych żadnych nowych projektów dla tych grup.
									</div>
								) : (
									<div className="flex flex-col gap-3">{globalSummary.map((item) => renderSummaryProject(item))}</div>
								)}
							</div>
						</div>

						<div className="rounded-b-2xl border-t border-slate-100 bg-slate-50 p-4 md:p-6">
							<button
								onClick={() => navigate('/')}
								className="w-full cursor-pointer rounded-xl bg-slate-800 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-slate-900 md:py-4 md:text-lg"
							>
								Zakończ sesję i wróć na pulpit
							</button>
						</div>
					</div>
				</div>
			)}


		</div>
	);
}
