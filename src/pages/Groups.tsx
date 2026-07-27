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
} from 'react-bootstrap-icons';
import { groupService, type Group } from '../api/groupService';
import toast from 'react-hot-toast';

export function Groups() {
	const navigate = useNavigate();

	const [allGroups, setAllGroups] = useState<Group[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
	const ITEMS_PER_PAGE = 15;

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
		if (currentPage > 1) setCurrentPage((prev) => prev - 1);
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
	};

	const handleDelete = async (id: string, name: string) => {
		if (!window.confirm(`Czy na pewno chcesz usunąć grupę "${name}"? Spowoduje to odpięcie przypisanych uczniów!`))
			return;

		try {
			await groupService.delete(id);
			toast.success('Grupa została usunięta z systemu.');

			setAllGroups((prev) => prev.filter((g) => g.id !== id));

			// NOWE: Zabezpieczenie paginacji (zamiast useEffect)
			// Jeśli to była ostatnia widoczna grupa na tej stronie, cofamy się o 1.
			if (displayedGroups.length === 1 && currentPage > 1) {
				setCurrentPage((prev) => prev - 1);
			}
		} catch (error) {
			toast.error('Nie udało się usunąć grupy.');
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
						onClick={() => setViewMode('active')}
						className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
							viewMode === 'active' 
								? 'bg-blue-100 text-blue-700' 
								: 'text-slate-500 hover:bg-slate-50'
						}`}
					>
						Aktywne grupy
					</button>
					<button
						onClick={() => setViewMode('archived')}
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
						}}
						placeholder="Szukaj grupy po nazwie lub oddziale..."
						className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</div>
			</div>

			{/* TABELA Z DANYMI */}
			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-slate-50 text-slate-500">
							<tr>
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
									<td colSpan={3} className="p-8 text-center font-bold text-slate-400">
										Ładowanie grup...
									</td>
								</tr>
							) : displayedGroups.length === 0 ? (
								<tr>
									<td colSpan={3} className="p-8 text-center text-slate-500">
										Brak grup spełniających kryteria.
									</td>
								</tr>
							) : (
								displayedGroups.map((group) => (
									<tr
										key={group.id}
										className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
									>
										<td className="p-4">
											<div className="flex flex-col">
												<div className="flex items-center gap-2 font-bold text-slate-800">
													<PeopleFill className="text-blue-500" size={16} />
													{group.name}
												</div>
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
										<td className="p-4 text-center">
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
		</div>
	);
}
