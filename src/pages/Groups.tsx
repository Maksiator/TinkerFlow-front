import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	PlusLg,
	PencilFill,
	TrashFill,
	Search,
	BuildingFill,
	PeopleFill,
	ChevronLeft,
	ChevronRight,
	PrinterFill,
	ExclamationTriangleFill,
} from 'react-bootstrap-icons';
import { groupService, type Group, GroupType } from '../api/groupService';
import { branchService, type Branch } from '../api/branchService';
import { userService, type User, UserRole } from '../api/userService';
import { authService } from '../api/authService';
import toast from 'react-hot-toast';

export function Groups() {
	const navigate = useNavigate();

	const [allGroups, setAllGroups] = useState<Group[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
	const ITEMS_PER_PAGE = 15;

	// Stany operacji masowych
	const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
	const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
	const [isBulkBranchModalOpen, setIsBulkBranchModalOpen] = useState(false);
	const [isBulkPrinterModalOpen, setIsBulkPrinterModalOpen] = useState(false);
	const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

	// Dane do modalu zmiany oddziału
	const [branches, setBranches] = useState<Branch[]>([]);
	const [selectedBranchId, setSelectedBranchId] = useState<string>('');

	// Dane do modalu przypisania do drukarza
	const [printers, setPrinters] = useState<User[]>([]);
	const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');

	// IDEALNY USE_EFFECT (Zgodnie z Twoim wzorcem)
	useEffect(() => {
		let isMounted = true;

		const fetchAllGroups = async () => {
			setIsLoading(true);
			try {
				// Jeśli wybraliśmy archiwum, musimy pobrać z parametrem includeArchived=true
				const data = await groupService.getAll(viewMode === 'archived');
				if (isMounted) {
					setAllGroups(data);
					setCurrentPage(1);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error('Błąd pobierania bazy grup.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchAllGroups();

		return () => {
			isMounted = false;
		};
	}, [viewMode]);

	// LOKALNE FILTROWANIE (Synchroniczne, bez setTimeout)
	const filteredGroups = useMemo(() => {
		let filtered = allGroups;
		
		if (viewMode === 'active') {
			filtered = filtered.filter(g => !g.isArchived);
		} else {
			filtered = filtered.filter(g => g.isArchived);
		}

		if (!searchTerm) return filtered;
		return filtered.filter(
			(g) =>
				g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(g.branchName && g.branchName.toLowerCase().includes(searchTerm.toLowerCase())),
		);
	}, [allGroups, searchTerm, viewMode]);

	const formatDay = (dayNum?: number | null) => {
		if (dayNum === null || dayNum === undefined) return 'Nie ustalono';
		const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
		return days[dayNum] || 'Nie ustalono';
	};

	// OBLICZANIE STRON
	const totalCount = filteredGroups.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

	// WYCINANIE GRUP DLA OBECNEJ STRONY
	const displayedGroups = useMemo(() => {
		const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
		return filteredGroups.slice(startIndex, startIndex + ITEMS_PER_PAGE);
	}, [filteredGroups, currentPage]);

	const handlePrevPage = () => {
		if (currentPage > 1) {
			setCurrentPage((prev) => prev - 1);
			setSelectedGroupIds([]);
		}
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) {
			setCurrentPage((prev) => prev + 1);
			setSelectedGroupIds([]);
		}
	};

	// Obsługa zaznaczania
	const isAllPageSelected =
		displayedGroups.length > 0 && displayedGroups.every((g) => selectedGroupIds.includes(g.id));

	const toggleSelectAllPage = () => {
		if (isAllPageSelected) {
			const pageIds = new Set(displayedGroups.map((g) => g.id));
			setSelectedGroupIds((prev) => prev.filter((id) => !pageIds.has(id)));
		} else {
			const pageIds = displayedGroups.map((g) => g.id);
			setSelectedGroupIds((prev) => Array.from(new Set([...prev, ...pageIds])));
		}
	};

	const toggleSelectGroup = (id: string) => {
		setSelectedGroupIds((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
		);
	};

	// Zaznaczone grupy i ich podział na puste vs ze studentami
	const selectedGroups = useMemo(() => {
		return allGroups.filter((g) => selectedGroupIds.includes(g.id));
	}, [allGroups, selectedGroupIds]);

	const groupsWithStudents = useMemo(() => {
		return selectedGroups.filter((g) => g.studentCount > 0);
	}, [selectedGroups]);

	const emptySelectedGroups = useMemo(() => {
		return selectedGroups.filter((g) => g.studentCount === 0);
	}, [selectedGroups]);

	// Masowe usuwanie
	const handleConfirmBulkDelete = async (onlyEmpty: boolean = false) => {
		const targetIds = onlyEmpty
			? emptySelectedGroups.map((g) => g.id)
			: selectedGroupIds;

		if (targetIds.length === 0) return;
		setIsSubmittingBulk(true);
		try {
			const result = await groupService.deleteBulk(targetIds);
			toast.success(result.message || `Pomyślnie usunięto ${targetIds.length} grup.`);
			setAllGroups((prev) => prev.filter((g) => !targetIds.includes(g.id)));
			setSelectedGroupIds((prev) => prev.filter((id) => !targetIds.includes(id)));
			setIsBulkDeleteModalOpen(false);
		} catch (error: any) {
			const msg = error.response?.data?.message || 'Nie udało się usunąć wybranych grup.';
			toast.error(msg);
		} finally {
			setIsSubmittingBulk(false);
		}
	};

	// Masowa zmiana oddziału
	const openBulkBranchModal = async () => {
		try {
			const branchList = await branchService.getAll();
			setBranches(branchList);
			if (branchList.length > 0) {
				setSelectedBranchId(branchList[0].id);
			}
			setIsBulkBranchModalOpen(true);
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się pobrać listy oddziałów.');
		}
	};

	const handleConfirmBulkChangeBranch = async () => {
		if (selectedGroupIds.length === 0 || !selectedBranchId) return;
		setIsSubmittingBulk(true);
		try {
			const result = await groupService.changeBranchBulk(selectedGroupIds, selectedBranchId);
			const chosenBranch = branches.find((b) => b.id === selectedBranchId);
			const branchName = chosenBranch ? chosenBranch.name : '';

			toast.success(result.message || 'Pomyślnie zmieniono oddział.');
			setAllGroups((prev) =>
				prev.map((g) =>
					selectedGroupIds.includes(g.id)
						? { ...g, branchId: selectedBranchId, branchName }
						: g
				)
			);
			setSelectedGroupIds([]);
			setIsBulkBranchModalOpen(false);
		} catch (error: any) {
			const msg = error.response?.data?.message || 'Nie udało się zmienić oddziału.';
			toast.error(msg);
		} finally {
			setIsSubmittingBulk(false);
		}
	};

	// Masowe przypisanie do drukarza
	const openBulkPrinterModal = async () => {
		try {
			const fetchedUsersResponse = await userService.getAll(undefined, 1, 9999);
			const fetchedUsers = Array.isArray(fetchedUsersResponse)
				? fetchedUsersResponse
				: ((fetchedUsersResponse as { items?: User[] }).items ?? []);

			const availablePrinters = fetchedUsers.filter(
				(u: User) => u.role === UserRole.Printer || (u.role === UserRole.Trainer && !!u.canActAsPrinter),
			);
			setPrinters(availablePrinters);
			setSelectedPrinterId('');
			setIsBulkPrinterModalOpen(true);
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się pobrać listy drukarzy.');
		}
	};

	const handleConfirmBulkAssignPrinter = async () => {
		if (selectedGroupIds.length === 0) return;
		setIsSubmittingBulk(true);
		try {
			const printerId = selectedPrinterId === '' ? null : selectedPrinterId;
			const result = await groupService.assignPrinterBulk(selectedGroupIds, printerId);
			const chosenPrinter = printers.find((p) => p.id === printerId);
			const printerName = chosenPrinter ? `${chosenPrinter.firstName} ${chosenPrinter.lastName}`.trim() : null;

			toast.success(result.message || 'Pomyślnie zaktualizowano przypisanego drukarza.');
			setAllGroups((prev) =>
				prev.map((g) =>
					selectedGroupIds.includes(g.id)
						? { ...g, assignedPrinterId: printerId, assignedPrinterName: printerName }
						: g
				)
			);
			setSelectedGroupIds([]);
			setIsBulkPrinterModalOpen(false);
		} catch (error: any) {
			const msg = error.response?.data?.message || 'Nie udało się przypisać drukarza.';
			toast.error(msg);
		} finally {
			setIsSubmittingBulk(false);
		}
	};

	const handleDelete = async (id: string, name: string) => {
		if (!window.confirm(`Czy na pewno chcesz usunąć grupę "${name}"? Spowoduje to odpięcie przypisanych uczniów!`))
			return;

		try {
			await groupService.delete(id);
			toast.success('Grupa została usunięta z systemu.');

			setAllGroups((prev) => prev.filter((g) => g.id !== id));
			setSelectedGroupIds((prev) => prev.filter((item) => item !== id));

			// Jeśli to była ostatnia widoczna grupa na tej stronie, cofamy się o 1.
			if (displayedGroups.length === 1 && currentPage > 1) {
				setCurrentPage((prev) => prev - 1);
			}
		} catch (error: any) {
			const msg = error.response?.data?.message || 'Nie udało się usunąć grupy.';
			toast.error(msg);
			console.error(error);
		}
	};

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			{/* NAGŁÓWEK OKNA */}
			<div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="text-3xl font-extrabold text-slate-800">Zarządzanie Grupami</h1>
					<p className="text-slate-500">
						Przeglądaj profile grup, przypisuj oddziały i zarządzaj zespołami zajęciowymi.
					</p>
				</div>

				<button
					onClick={() => navigate('/grupy/nowa')}
					className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-700 md:w-auto"
				>
					<PlusLg /> Dodaj grupę
				</button>
			</div>

			{/* PAS WYSZUKIWARKI I ZAKŁADEK */}
			<div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="mb-4 flex gap-4 border-b border-slate-100 pb-4">
					<button
						onClick={() => {
							setViewMode('active');
							setSelectedGroupIds([]);
						}}
						className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
							viewMode === 'active' 
								? 'bg-blue-100 text-blue-700' 
								: 'text-slate-500 hover:bg-slate-50'
						}`}
					>
						Aktywne grupy
					</button>
					<button
						onClick={() => {
							setViewMode('archived');
							setSelectedGroupIds([]);
						}}
						className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
							viewMode === 'archived' 
								? 'bg-red-100 text-red-700' 
								: 'text-slate-500 hover:bg-slate-50'
						}`}
					>
						Archiwum grup
					</button>
				</div>
				<div className="relative">
					<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setCurrentPage(1);
							setSelectedGroupIds([]);
						}}
						placeholder="Szukaj grupy po nazwie lub oddziale..."
						className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</div>
			</div>

			{/* PASEK OPERACJI MASOWYCH */}
			{selectedGroupIds.length > 0 && (
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm backdrop-blur-sm">
					<div className="flex items-center gap-3">
						<span className="inline-flex h-7 items-center justify-center rounded-full bg-blue-600 px-3 text-xs font-black text-white shadow-sm">
							{selectedGroupIds.length}
						</span>
						<span className="text-sm font-bold text-slate-800">
							Zaznaczono {selectedGroupIds.length === 1 ? 'grupę' : 'grup'}
						</span>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							onClick={openBulkBranchModal}
							className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
						>
							<BuildingFill size={14} /> Zmień oddział
						</button>

						<button
							onClick={openBulkPrinterModal}
							className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-purple-300 bg-white px-3.5 py-2 text-xs font-bold text-purple-700 shadow-sm transition-colors hover:bg-purple-50"
						>
							<PrinterFill size={14} /> Przypisz do drukarza
						</button>

						<button
							onClick={() => setIsBulkDeleteModalOpen(true)}
							className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-red-700"
						>
							<TrashFill size={14} /> Usuń ({selectedGroupIds.length})
						</button>

						<button
							onClick={() => setSelectedGroupIds([])}
							className="cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-blue-100/70 hover:text-slate-800"
						>
							Odznacz wszystko
						</button>
					</div>
				</div>
			)}

			{/* TABELA Z DANYMI */}
			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-slate-50 text-slate-500">
							<tr>
								<th className="w-12 border-b border-slate-200 p-4 text-center">
									<input
										type="checkbox"
										checked={isAllPageSelected}
										onChange={toggleSelectAllPage}
										title="Zaznacz wszystkie na tej stronie"
										className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
									/>
								</th>
								<th className="border-b border-slate-200 p-4 font-bold">Nazwa grupy</th>
								<th className="border-b border-slate-200 p-4 font-bold">Przypisany Oddział</th>
								<th className="border-b border-slate-200 p-4 font-bold">Prowadzący</th>
								<th className="border-b border-slate-200 p-4 font-bold">Dzień</th>
								<th className="border-b border-slate-200 p-4 font-bold">Uczniów</th>
								<th className="border-b border-slate-200 p-4 text-center font-bold">Akcje</th>
							</tr>
						</thead>
						<tbody>
							{isLoading ? (
								<tr>
									<td colSpan={7} className="p-8 text-center font-bold text-slate-400">
										Ładowanie grup...
									</td>
								</tr>
							) : displayedGroups.length === 0 ? (
								<tr>
									<td colSpan={7} className="p-8 text-center text-slate-500">
										Brak grup spełniających kryteria.
									</td>
								</tr>
							) : (
								displayedGroups.map((group) => (
									<tr
										key={group.id}
										onClick={() => navigate(`/grupy/${group.id}`)}
										className={`group cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-blue-50/40 ${
											selectedGroupIds.includes(group.id) ? 'bg-blue-50/70' : ''
										}`}
									>
										<td className="w-12 p-4 text-center" onClick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedGroupIds.includes(group.id)}
												onChange={() => toggleSelectGroup(group.id)}
												className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
											/>
										</td>
										<td className="p-4">
											<div className="flex flex-col">
												<div className="flex items-center gap-2 font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
													<PeopleFill className="text-blue-500 group-hover:text-blue-700 transition-colors" size={16} />
													<span>{group.name}</span>
													{authService.getCurrentUser()?.role === UserRole.Admin && group.type === GroupType.Advanced && (
														<span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black tracking-tight text-indigo-700 uppercase border border-indigo-200">
															Zaawansowana
														</span>
													)}
												</div>
												{group.assignedPrinterName && (
													<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 mt-0.5">
														<PrinterFill size={10} className="text-purple-500" />
														Drukarz: {group.assignedPrinterName}
													</span>
												)}
												{group.isArchived && (
													<span className="text-xs font-bold text-red-500 mt-1">
														Zarchiwizowana ({group.archivedAcademicYear})
													</span>
												)}
											</div>
										</td>
										<td className="p-4">
											{group.branchName ? (
												<span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
													<BuildingFill className="text-slate-400" size={14} />
													{group.branchName}
												</span>
											) : (
												<span className="text-slate-400 italic">Brak</span>
											)}
										</td>
										<td className="p-4 text-slate-700">
											{group.primaryTrainerName || <span className="text-slate-400 italic">Nie wybrano</span>}
										</td>
										<td className="p-4 text-slate-700 font-medium">
											{formatDay(group.classDayOfWeek)}
										</td>
										<td className="p-4 font-bold text-slate-800">
											{group.studentCount}
										</td>
										<td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
											<div className="flex items-center justify-center gap-2">
												<button
													onClick={() => navigate(`/grupy/${group.id}`)}
													className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
													title="Edytuj grupę"
												>
													<PencilFill size={14} />
												</button>
												<button
													onClick={() => handleDelete(group.id, group.name)}
													className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
													title="Usuń grupę"
												>
													<TrashFill size={14} />
												</button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* PASEK PAGINACJI */}
				{!isLoading && totalCount > 0 && (
					<div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row">
						<span className="text-xs font-medium text-slate-500">
							Pokazano stronę {currentPage} z {totalPages} (łącznie grup: {totalCount})
						</span>

						<div className="flex items-center gap-2">
							<button
								onClick={handlePrevPage}
								disabled={currentPage === 1}
								className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<ChevronLeft size={16} />
							</button>

							<span className="px-3 text-sm font-bold text-slate-700">{currentPage}</span>

							<button
								onClick={handleNextPage}
								disabled={currentPage >= totalPages}
								className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<ChevronRight size={16} />
							</button>
						</div>
					</div>
				)}
			</div>

			{/* MODAL MASOWEGO USUWANIA GRUP */}
			{isBulkDeleteModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center gap-3 text-red-600">
							<div className="rounded-full bg-red-100 p-3">
								<ExclamationTriangleFill size={24} />
							</div>
							<div>
								<h3 className="text-lg font-extrabold text-slate-800">Usuń zaznaczone grupy</h3>
								<p className="text-xs text-slate-500">Operacja jest nieodwracalna</p>
							</div>
						</div>

						{groupsWithStudents.length > 0 ? (
							<div className="mb-4">
								<p className="mb-2 text-sm text-slate-700">
									Niektóre z zaznaczonych grup mają przypisanych uczniów i nie mogą zostać usunięte:
								</p>
								<div className="max-h-36 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
									<ul className="list-disc pl-4 space-y-1">
										{groupsWithStudents.map((g) => (
											<li key={g.id}>
												<strong>{g.name}</strong> ({g.studentCount} uczniów)
											</li>
										))}
									</ul>
								</div>
								{emptySelectedGroups.length > 0 && (
									<p className="mt-3 text-xs text-slate-500">
										Możesz usunąć tylko te grupy, które są obecnie puste ({emptySelectedGroups.length} grup).
									</p>
								)}
							</div>
						) : (
							<p className="mb-4 text-sm text-slate-600">
								Czy na pewno chcesz usunąć <strong>{selectedGroupIds.length}</strong> zaznaczonych grup? Wszystkie te grupy są puste.
							</p>
						)}

						<div className="flex gap-3">
							<button
								onClick={() => setIsBulkDeleteModalOpen(false)}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
							>
								Anuluj
							</button>
							{groupsWithStudents.length > 0 ? (
								emptySelectedGroups.length > 0 ? (
									<button
										onClick={() => handleConfirmBulkDelete(true)}
										disabled={isSubmittingBulk}
										className="flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
									>
										{isSubmittingBulk ? 'Usuwanie...' : `Usuń tylko puste (${emptySelectedGroups.length})`}
									</button>
								) : (
									<button
										disabled
										className="flex-1 cursor-not-allowed rounded-xl bg-slate-300 py-2.5 text-sm font-bold text-slate-500"
									>
										Brak pustych grup
									</button>
								)
							) : (
								<button
									onClick={() => handleConfirmBulkDelete(false)}
									disabled={isSubmittingBulk}
									className="flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
								>
									{isSubmittingBulk ? 'Usuwanie...' : `Usuń (${selectedGroupIds.length})`}
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* MODAL MASOWEJ ZMIANY ODDZIAŁU */}
			{isBulkBranchModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center gap-3 text-blue-600">
							<div className="rounded-full bg-blue-100 p-3">
								<BuildingFill size={24} />
							</div>
							<div>
								<h3 className="text-lg font-extrabold text-slate-800">Masowa zmiana oddziału</h3>
								<p className="text-xs text-slate-500">Dotyczy {selectedGroupIds.length} zaznaczonych grup</p>
							</div>
						</div>

						<div className="mb-4">
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
								Docelowy oddział
							</label>
							<select
								value={selectedBranchId}
								onChange={(e) => setSelectedBranchId(e.target.value)}
								className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							>
								{branches.map((b) => (
									<option key={b.id} value={b.id}>
										{b.name}
									</option>
								))}
							</select>
						</div>

						<div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
							Przypisanie tych grup do nowego oddziału spowoduje również zaktualizowanie oddziału dla wszystkich przypisanych do nich uczniów.
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setIsBulkBranchModalOpen(false)}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								onClick={handleConfirmBulkChangeBranch}
								disabled={isSubmittingBulk || !selectedBranchId}
								className="flex-1 cursor-pointer rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
							>
								{isSubmittingBulk ? 'Zapisywanie...' : 'Zmień oddział'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL MASOWEGO PRZYPISANIA DO DRUKARZA */}
			{isBulkPrinterModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center gap-3 text-purple-600">
							<div className="rounded-full bg-purple-100 p-3">
								<PrinterFill size={24} />
							</div>
							<div>
								<h3 className="text-lg font-extrabold text-slate-800">Przypisz do drukarza</h3>
								<p className="text-xs text-slate-500">Dotyczy {selectedGroupIds.length} zaznaczonych grup</p>
							</div>
						</div>

						<div className="mb-4">
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
								Wybierz drukarza
							</label>
							<select
								value={selectedPrinterId}
								onChange={(e) => setSelectedPrinterId(e.target.value)}
								className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
							>
								<option value="">-- Brak przypisanego drukarza (usuń przypisanie) --</option>
								{printers.map((p) => (
									<option key={p.id} value={p.id}>
										{p.firstName} {p.lastName}{p.role === UserRole.Trainer ? ' (Trener)' : ''} ({p.email})
									</option>
								))}
							</select>
						</div>

						<div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">
							Wybrany drukarz w swoim panelu zleceń druku będzie widział wyłącznie paczki z przypisanych do siebie grup.
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setIsBulkPrinterModalOpen(false)}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								onClick={handleConfirmBulkAssignPrinter}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl bg-purple-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50"
							>
								{isSubmittingBulk ? 'Zapisywanie...' : 'Zastosuj'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
