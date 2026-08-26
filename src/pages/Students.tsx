import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	PlusLg,
	PencilFill,
	TrashFill,
	Search,
	PersonFillExclamation,
	StarFill,
	CloudArrowUpFill,
	ChevronLeft,
	ChevronRight,
	ArrowUp,
	ArrowDown,
	SortDown,
} from 'react-bootstrap-icons';
import { studentService, type Student, SkillLevel } from '../api/studentService';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import toast from 'react-hot-toast';

export function Students() {
	const navigate = useNavigate();
	const currentUser = authService.getCurrentUser();
	const isTrainer = currentUser?.role === UserRole.Trainer;

	// Stany danych
	const [students, setStudents] = useState<Student[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Stany wyszukiwarki i paginacji
	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCount, setTotalCount] = useState(0);

	// Stany sortowania
	const [sortBy, setSortBy] = useState('lastName');
	const [sortOrder, setSortOrder] = useState('asc');

	// Główna funkcja pobierająca
	const fetchStudents = async (page: number, search: string, sortField: string, order: string) => {
		setIsLoading(true);
		try {
			const data = await studentService.getAll(search, sortField, order, page, 15);
			setStudents(data.items);
			setTotalPages(data.totalPages);
			setTotalCount(data.totalCount);
		} catch (error) {
			toast.error('Błąd pobierania bazy uczniów.');
			console.error('Błąd pobierania bazy uczniów:', error);
		} finally {
			setIsLoading(false);
		}
	};

	// Effect do wyszukiwarki (z debouncingiem 500ms) i sortowania
	useEffect(() => {
		const delayDebounceFn = setTimeout(() => {
			setCurrentPage(1); // Zawsze wracaj na pierwszą stronę po nowym wyszukiwaniu/sortowaniu
			fetchStudents(1, searchTerm, sortBy, sortOrder);
		}, 500);

		return () => clearTimeout(delayDebounceFn);
	}, [searchTerm, sortBy, sortOrder]);

	// Funkcje zmiany stron
	const handlePrevPage = () => {
		if (currentPage > 1) {
			const newPage = currentPage - 1;
			setCurrentPage(newPage);
			fetchStudents(newPage, searchTerm, sortBy, sortOrder);
		}
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) {
			const newPage = currentPage + 1;
			setCurrentPage(newPage);
			fetchStudents(newPage, searchTerm, sortBy, sortOrder);
		}
	};

	const handleSort = (field: string) => {
		if (sortBy === field) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
		} else {
			setSortBy(field);
			setSortOrder('asc');
		}
	};

	const SortIcon = ({ field }: { field: string }) => {
		if (sortBy !== field) return <SortDown className="text-slate-300 ml-1 inline-block" />;
		return sortOrder === 'asc' ? <ArrowUp className="text-blue-500 ml-1 inline-block" /> : <ArrowDown className="text-blue-500 ml-1 inline-block" />;
	};

	// Usuwanie
	const handleDelete = async (id: string, firstName: string, lastName: string) => {
		if (!window.confirm(`Czy na pewno chcesz usunąć ucznia ${firstName} ${lastName}?`)) return;

		try {
			await studentService.delete(id);
			toast.success('Uczeń został usunięty z bazy.');

			// Po usunięciu pobieramy aktualną stronę na nowo,
			// żeby backend dorzucił nam brakującego ucznia z kolejnej strony
			fetchStudents(currentPage, searchTerm, sortBy, sortOrder);
		} catch (error) {
			toast.error('Nie udało się usunąć ucznia.');
			console.error('Błąd usuwania ucznia:', error);
		}
	};

	const renderLevelBadge = (level: SkillLevel) => {
		switch (level) {
			case SkillLevel.Beginner:
				return <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-bold text-green-700">Początkujący</span>;
			case SkillLevel.Intermediate:
				return <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">Średnio</span>;
			case SkillLevel.Advanced:
				return (
					<span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">Zaawansowany</span>
				);
			default:
				return null;
		}
	};

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			<div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="text-3xl font-extrabold text-slate-800">Baza Uczniów</h1>
					<p className="text-slate-500">Zarządzaj wszystkimi uczniami, dodawaj nowych i edytuj profile.</p>
				</div>

				{!isTrainer && (
					<div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
						<button
							onClick={() => navigate('/uczniowie/masowo')}
							className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 font-bold text-white shadow-md transition-colors hover:bg-green-700 md:w-auto"
						>
							<CloudArrowUpFill /> Masowy import
						</button>
						<button
							onClick={() => navigate('/uczniowie/nowy')}
							className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-700 md:w-auto"
						>
							<PlusLg /> Dodaj ucznia
						</button>
					</div>
				)}
			</div>

			<div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="relative">
					<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Szukaj po nazwisku, imieniu lub grupie..."
						className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-slate-50 text-slate-500">
							<tr>
								<th 
									className="border-b border-slate-200 p-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
									onClick={() => handleSort('lastName')}
								>
									<div className="flex items-center">Imię i Nazwisko <SortIcon field="lastName" /></div>
								</th>
								<th 
									className="border-b border-slate-200 p-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
									onClick={() => handleSort('dateOfBirth')}
								>
									<div className="flex items-center">Rocznik <SortIcon field="dateOfBirth" /></div>
								</th>
								<th 
									className="border-b border-slate-200 p-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors"
									onClick={() => handleSort('group')}
								>
									<div className="flex items-center">Grupa <SortIcon field="group" /></div>
								</th>
								<th className="border-b border-slate-200 p-4 font-bold">Poziom</th>
								<th className="border-b border-slate-200 p-4 text-center font-bold">Akcje</th>
							</tr>
						</thead>
						<tbody>
							{isLoading ? (
								<tr>
									<td colSpan={5} className="p-8 text-center font-bold text-slate-400">
										Pobieranie bazy...
									</td>
								</tr>
							) : students.length === 0 ? (
								<tr>
									<td colSpan={5} className="p-8 text-center text-slate-500">
										Brak wyników.
									</td>
								</tr>
							) : (
								students.map((student: Student) => (
									<tr
										key={student.id}
										className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
									>
										<td className="p-4">
											<div className="flex items-center gap-2 font-bold text-slate-800">
												{student.firstName} {student.lastName}
												{student.isIndependent && (
													<StarFill className="text-xs text-yellow-400" title="Pracuje samodzielnie" />
												)}
												{student.needsAttention && (
													<PersonFillExclamation className="text-xs text-red-500" title="Wymaga uwagi" />
												)}
											</div>
										</td>
										<td className="p-4 text-slate-600">{student.dateOfBirth.substring(0, 4)}</td>
										<td className="p-4">
											{student.groupName ? (
												<span className="font-medium text-slate-700">{student.groupName}</span>
											) : (
												<span className="text-slate-400 italic">Brak grupy</span>
											)}
										</td>
										<td className="p-4">{renderLevelBadge(student.level)}</td>
										<td className="p-4 text-center">
											<div className="flex items-center justify-center gap-2">
												<button
													onClick={() => navigate(`/uczniowie/${student.id}`)}
													className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
												>
													<PencilFill />
												</button>
												{!isTrainer && (
													<button
														onClick={() => handleDelete(student.id, student.firstName, student.lastName)}
														className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
													>
														<TrashFill />
													</button>
												)}
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
							Pokazano stronę {currentPage} z {totalPages} (łącznie: {totalCount})
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
