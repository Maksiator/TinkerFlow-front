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
	EyeFill,
	PeopleFill,
	ExclamationTriangleFill,
	ArrowLeftRight,
} from 'react-bootstrap-icons';
import { studentService, type Student, SkillLevel } from '../api/studentService';
import { groupService, type Group } from '../api/groupService';
import { systemSettingsService } from '../api/systemSettingsService';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import toast from 'react-hot-toast';
import { TransferStudentModal } from '../components/TransferStudentModal';

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

	// Stany masowych operacji
	const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
	const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
	const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false);
	const [studentToTransfer, setStudentToTransfer] = useState<Student | null>(null);
	const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

	// Dane do modalu zmiany grupy
	const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
	const [bulkTargetGroupId, setBulkTargetGroupId] = useState<string>('');
	const [bulkRecordHistory, setBulkRecordHistory] = useState(true);
	const [bulkIsMidYear, setBulkIsMidYear] = useState(true);
	const [bulkAcademicYear, setBulkAcademicYear] = useState('2024/2025');

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
			setSelectedStudentIds([]);
			fetchStudents(1, searchTerm, sortBy, sortOrder);
		}, 500);

		return () => clearTimeout(delayDebounceFn);
	}, [searchTerm, sortBy, sortOrder]);

	// Funkcje zmiany stron
	const handlePrevPage = () => {
		if (currentPage > 1) {
			const newPage = currentPage - 1;
			setCurrentPage(newPage);
			setSelectedStudentIds([]);
			fetchStudents(newPage, searchTerm, sortBy, sortOrder);
		}
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) {
			const newPage = currentPage + 1;
			setCurrentPage(newPage);
			setSelectedStudentIds([]);
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

	// Obsługa zaznaczania
	const isAllPageSelected =
		students.length > 0 && students.every((s) => selectedStudentIds.includes(s.id));

	const toggleSelectAllPage = () => {
		if (isAllPageSelected) {
			const pageIds = new Set(students.map((s) => s.id));
			setSelectedStudentIds((prev) => prev.filter((id) => !pageIds.has(id)));
		} else {
			const pageIds = students.map((s) => s.id);
			setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
		}
	};

	const toggleSelectStudent = (id: string) => {
		setSelectedStudentIds((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
		);
	};

	const openBulkGroupModal = async () => {
		try {
			const [groupsData, settings] = await Promise.all([
				groupService.getAll().catch(() => []),
				systemSettingsService.getSettings().catch(() => null),
			]);
			setAvailableGroups(groupsData.filter((g) => !g.isArchived));
			if (settings?.currentAcademicYear) {
				setBulkAcademicYear(settings.currentAcademicYear);
			}
			setBulkTargetGroupId('');
			setBulkRecordHistory(true);
			setBulkIsMidYear(true);
			setIsBulkGroupModalOpen(true);
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się załadować listy grup.');
		}
	};

	const handleConfirmBulkDelete = async () => {
		if (selectedStudentIds.length === 0) return;
		setIsSubmittingBulk(true);
		try {
			const result = await studentService.deleteBulk(selectedStudentIds);
			toast.success(result.message || `Pomyślnie usunięto ${selectedStudentIds.length} uczniów.`);
			setSelectedStudentIds([]);
			setIsBulkDeleteModalOpen(false);
			fetchStudents(currentPage, searchTerm, sortBy, sortOrder);
		} catch (error: any) {
			const msg = error.response?.data?.message || 'Nie udało się usunąć zaznaczonych uczniów.';
			toast.error(msg);
		} finally {
			setIsSubmittingBulk(false);
		}
	};

	const handleConfirmBulkChangeGroup = async () => {
		if (selectedStudentIds.length === 0) return;
		setIsSubmittingBulk(true);
		try {
			const targetGroupId = bulkTargetGroupId === '' ? null : bulkTargetGroupId;
			const result = await studentService.changeGroupBulk(selectedStudentIds, targetGroupId, {
				recordHistory: bulkRecordHistory,
				isMidYear: bulkIsMidYear,
				academicYear: bulkAcademicYear,
			});
			toast.success(result.message || 'Pomyślnie zaktualizowano grupy dla zaznaczonych uczniów.');
			setSelectedStudentIds([]);
			setIsBulkGroupModalOpen(false);
			fetchStudents(currentPage, searchTerm, sortBy, sortOrder);
		} catch (error: any) {
			const msg = error.response?.data?.message || 'Nie udało się zaktualizować grupy.';
			toast.error(msg);
		} finally {
			setIsSubmittingBulk(false);
		}
	};

	// Usuwanie pojedyncze
	const handleDelete = async (id: string, firstName: string, lastName: string) => {
		if (!window.confirm(`Czy na pewno chcesz usunąć ucznia ${firstName} ${lastName}?`)) return;

		try {
			await studentService.delete(id);
			toast.success('Uczeń został usunięty z bazy.');
			setSelectedStudentIds((prev) => prev.filter((item) => item !== id));
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

			{/* PASEK OPERACJI MASOWYCH */}
			{selectedStudentIds.length > 0 && !isTrainer && (
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm backdrop-blur-sm">
					<div className="flex items-center gap-3">
						<span className="inline-flex h-7 items-center justify-center rounded-full bg-blue-600 px-3 text-xs font-black text-white shadow-sm">
							{selectedStudentIds.length}
						</span>
						<span className="text-sm font-bold text-slate-800">
							Zaznaczono {selectedStudentIds.length === 1 ? 'ucznia' : 'uczniów'}
						</span>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							onClick={openBulkGroupModal}
							className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
						>
							<PeopleFill size={14} /> Przypisz / Zmień grupę
						</button>

						<button
							onClick={() => setIsBulkDeleteModalOpen(true)}
							className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700"
						>
							<TrashFill size={14} /> Usuń zaznaczonych ({selectedStudentIds.length})
						</button>

						<button
							onClick={() => setSelectedStudentIds([])}
							className="cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-blue-100/70 hover:text-slate-800"
						>
							Odznacz wszystko
						</button>
					</div>
				</div>
			)}

			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-slate-50 text-slate-500">
							<tr>
								{!isTrainer && (
									<th className="w-12 border-b border-slate-200 p-4 text-center">
										<input
											type="checkbox"
											checked={isAllPageSelected}
											onChange={toggleSelectAllPage}
											title="Zaznacz wszystkich na tej stronie"
											className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
										/>
									</th>
								)}
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
									<td colSpan={isTrainer ? 5 : 6} className="p-8 text-center font-bold text-slate-400">
										Pobieranie bazy...
									</td>
								</tr>
							) : students.length === 0 ? (
								<tr>
									<td colSpan={isTrainer ? 5 : 6} className="p-8 text-center text-slate-500">
										Brak wyników.
									</td>
								</tr>
							) : (
								students.map((student: Student) => (
									<tr
										key={student.id}
										className={`border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 ${
											selectedStudentIds.includes(student.id) ? 'bg-blue-50/50' : ''
										}`}
									>
										{!isTrainer && (
											<td className="w-12 p-4 text-center">
												<input
													type="checkbox"
													checked={selectedStudentIds.includes(student.id)}
													onChange={() => toggleSelectStudent(student.id)}
													className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
												/>
											</td>
										)}
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
													title={isTrainer ? "Podgląd profilu i projektów" : "Edytuj dane ucznia"}
												>
													{isTrainer ? <EyeFill /> : <PencilFill />}
												</button>
												{!isTrainer && (
													<>
														<button
															onClick={() => setStudentToTransfer(student)}
															className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
															title="Przepisz ucznia do innej grupy"
														>
															<ArrowLeftRight />
														</button>
														<button
															onClick={() => handleDelete(student.id, student.firstName, student.lastName)}
															className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
															title="Usuń ucznia"
														>
															<TrashFill />
														</button>
													</>
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

			{/* MODAL MASOWEGO USUWANIA */}
			{isBulkDeleteModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center gap-3 text-red-600">
							<div className="rounded-full bg-red-100 p-3">
								<ExclamationTriangleFill size={24} />
							</div>
							<div>
								<h3 className="text-lg font-extrabold text-slate-800">Usuń zaznaczonych uczniów</h3>
								<p className="text-xs text-slate-500">Operacja jest nieodwracalna</p>
							</div>
						</div>

						<p className="mb-4 text-sm text-slate-600">
							Czy na pewno chcesz usunąć <strong>{selectedStudentIds.length}</strong> zaznaczonych uczniów?
						</p>

						<div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
							W przypadku uczniów przypisanych do grup, ślad po ich uczestnictwie zostanie zachowany w historii grupy.
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setIsBulkDeleteModalOpen(false)}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								onClick={handleConfirmBulkDelete}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
							>
								{isSubmittingBulk ? 'Usuwanie...' : `Usuń (${selectedStudentIds.length})`}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL MASOWEJ ZMIANY GRUPY */}
			{isBulkGroupModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center gap-3 text-blue-600">
							<div className="rounded-full bg-blue-100 p-3">
								<PeopleFill size={24} />
							</div>
							<div>
								<h3 className="text-lg font-extrabold text-slate-800">Masowe przypisanie do grupy</h3>
								<p className="text-xs text-slate-500">Dotyczy {selectedStudentIds.length} zaznaczonych uczniów</p>
							</div>
						</div>

						<div className="mb-4">
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
								Wybierz grupę docelową
							</label>
							<select
								value={bulkTargetGroupId}
								onChange={(e) => setBulkTargetGroupId(e.target.value)}
								className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							>
								<option value="">-- Brak grupy (Wypisz z obecnych grup) --</option>
								{availableGroups.map((g) => (
									<option key={g.id} value={g.id}>
										{g.name} ({g.branchName})
									</option>
								))}
							</select>
						</div>

						<div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
							<label className="mb-3 flex cursor-pointer items-center gap-2.5">
								<input
									type="checkbox"
									checked={bulkRecordHistory}
									onChange={(e) => setBulkRecordHistory(e.target.checked)}
									className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
								/>
								<span className="text-xs font-bold text-slate-700">
									Zapisz ślad w historii dotychczasowej grupy
								</span>
							</label>

							{bulkRecordHistory && (
								<div className="flex flex-col gap-3 pt-3 border-t border-slate-200">
									<div className="flex gap-4">
										<label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
											<input
												type="radio"
												name="bulkIsMidYear"
												checked={bulkIsMidYear}
												onChange={() => setBulkIsMidYear(true)}
												className="accent-blue-600"
											/>
											W trakcie roku
										</label>
										<label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
											<input
												type="radio"
												name="bulkIsMidYear"
												checked={!bulkIsMidYear}
												onChange={() => setBulkIsMidYear(false)}
												className="accent-blue-600"
											/>
											Koniec roku / Pomyłka
										</label>
									</div>

									<div>
										<label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase">
											Rok szkolny do zapisu
										</label>
										<input
											type="text"
											value={bulkAcademicYear}
											onChange={(e) => setBulkAcademicYear(e.target.value)}
											placeholder="np. 2024/2025"
											className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium outline-none focus:border-blue-500"
										/>
									</div>
								</div>
							)}
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setIsBulkGroupModalOpen(false)}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								onClick={handleConfirmBulkChangeGroup}
								disabled={isSubmittingBulk}
								className="flex-1 cursor-pointer rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
							>
								{isSubmittingBulk ? 'Zapisywanie...' : `Zastosuj (${selectedStudentIds.length})`}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL PRZEPISYWANIA UCZNIA (MIGRACJA 1-KLIKIEM) */}
			<TransferStudentModal
				isOpen={Boolean(studentToTransfer)}
				onClose={() => setStudentToTransfer(null)}
				student={
					studentToTransfer
						? {
								id: studentToTransfer.id,
								firstName: studentToTransfer.firstName,
								lastName: studentToTransfer.lastName,
								currentGroupId: studentToTransfer.groupId,
								currentGroupName: studentToTransfer.groupName,
						  }
						: null
				}
				onSuccess={() => {
					fetchStudents(currentPage, searchTerm, sortBy, sortOrder);
				}}
			/>
		</div>
	);
}
