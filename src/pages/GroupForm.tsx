import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupService, type CreateGroup } from '../api/groupService';
import { studentService, type Student, type StudentHistoryItem } from '../api/studentService';
import { branchService, type Branch } from '../api/branchService';
import { userService, type User, UserRole } from '../api/userService';
import { systemSettingsService } from '../api/systemSettingsService';
import { ArrowLeft, PlusLg, TrashFill, Search, PersonFillAdd, CloudArrowUpFill, ArchiveFill } from 'react-bootstrap-icons';
import toast from 'react-hot-toast';
import { authService } from '../api/authService';

export function GroupForm() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const isEditMode = Boolean(id) && id !== 'nowa';

	// --- STAN: DANE GRUPY I LISTY WYBORU ---
	const [formData, setFormData] = useState<CreateGroup>({ name: '', branchId: '', primaryTrainerId: null, assignedPrinterId: null, classDayOfWeek: null });
	const [branches, setBranches] = useState<Branch[]>([]);
	const [trainers, setTrainers] = useState<User[]>([]);
	const [printers, setPrinters] = useState<User[]>([]);

	const [isSaving, setIsSaving] = useState(false);
	const [isLoading, setIsLoading] = useState(true); // Na start true, bo zawsze musimy pobrać Branches
	const [isGroupArchived, setIsGroupArchived] = useState(false);

	// --- STAN: UCZNIOWIE W GRUPIE ---
	const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
	const [studentHistory, setStudentHistory] = useState<StudentHistoryItem[]>([]);

	// --- STAN: WYSZUKIWARKA UCZNIÓW ---
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<Student[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	// --- STAN: USTAWIANIE SYSTEMU I MODAL WYPISANIA ---
	const [systemAcademicYear, setSystemAcademicYear] = useState('2024/2025');
	const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
	const [removeReason, setRemoveReason] = useState<'midyear' | 'mistake'>('midyear');
	const [isRemoving, setIsRemoving] = useState(false);

	// ZAKTUALIZOWANY EFEKT: Bezpieczne pobieranie danych
	useEffect(() => {
		let isMounted = true;

		const fetchInitialData = async () => {
			setIsLoading(true);
			try {
				// 1. NAJPIERW pobieramy dane grupy, żeby formularz nie był pusty!
				if (isEditMode && id) {
					const group = await groupService.getById(id);
					const students = await studentService.getByGroup(id);

					if (isMounted) {
						setFormData({
							name: group.name,
							branchId: group.branchId,
							primaryTrainerId: group.primaryTrainerId,
							assignedPrinterId: group.assignedPrinterId ?? null,
							classDayOfWeek: group.classDayOfWeek ?? null,
						});
						setIsGroupArchived(group.isArchived ?? false);
						setEnrolledStudents(students);
					}
					
					// Pobieranie historii (bez blokowania w przypadku bledu np. braku uprawnien)
					try {
						const history = await studentService.getGroupHistory(id);
						if (isMounted) {
							setStudentHistory(history);
						}
					} catch (e) {
						console.error("Błąd pobierania historii", e);
					}
				}

				// 2. POTEM pobieramy słowniki
				const fetchedBranches = await branchService.getAll();
				const fetchedUsersResponse = await userService.getAll(undefined, 1, 9999);
				
				try {
					const sysSettings = await systemSettingsService.getSettings();
					if (isMounted) {
						setSystemAcademicYear(sysSettings.currentAcademicYear);
					}
				} catch (e) {
					console.error("Błąd ustawień", e);
				}

				// ZABEZPIECZENIE: Na wypadek gdyby endpoint users zwracał paginację { items: [...] } zamiast tablicy
				const fetchedUsers = Array.isArray(fetchedUsersResponse)
					? fetchedUsersResponse
					: ((fetchedUsersResponse as { items?: User[] }).items ?? []);

				// Wyłuskujemy tylko tych, którzy mogą prowadzić zajęcia
				const availableTrainers = fetchedUsers.filter(
					(u: User) => u.role === UserRole.Trainer || u.role === UserRole.Coordinator,
				);

				// Wyłuskujemy drukarzy
				const availablePrinters = fetchedUsers.filter(
					(u: User) => u.role === UserRole.Printer,
				);

				if (isMounted) {
					// FILTROWANIE ODDZIAŁÓW DLA KOORDYNATORA
					const currentUserToken = authService.getCurrentUser();
					let availableBranches = fetchedBranches;

					if (currentUserToken?.role === UserRole.Coordinator) {
						const coordinatorData = fetchedUsers.find((u: User) => u.id === currentUserToken.id);
						if (coordinatorData && coordinatorData.branches) {
							const coordinatorBranchIds = coordinatorData.branches.map((b: { branchId: Branch['id'] }) => b.branchId);
							availableBranches = fetchedBranches.filter((b: Branch) => coordinatorBranchIds.includes(b.id));
						}
					}

					setBranches(availableBranches);
					setTrainers(availableTrainers);
					setPrinters(availablePrinters);

					// Jeśli tworzymy nową grupę, ustawmy domyślnie pierwszy oddział na liście
					if (!isEditMode && availableBranches.length > 0) {
						setFormData((prev) => ({ ...prev, branchId: availableBranches[0].id }));
					}
				}
			} catch (error) {
				// TERAZ WYPISZEMY DOKŁADNY BŁĄD W KONSOLI (F12 -> zakładka Console)
				console.error('Szczegóły błędu formularza:', error);
				if (isMounted) toast.error('Błąd pobierania danych formularza.');
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchInitialData();

		return () => {
			isMounted = false;
		};
	}, [id, isEditMode]);

	// ZAPISYWANIE GRUPY
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.branchId) {
			toast.error('Musisz wybrać oddział dla grupy!');
			return;
		}

		setIsSaving(true);
		try {
			// Transformujemy puste stringi z selectów na null
			const payload = {
				...formData,
				primaryTrainerId: formData.primaryTrainerId === '' ? null : formData.primaryTrainerId,
				assignedPrinterId: formData.assignedPrinterId === '' ? null : formData.assignedPrinterId,
			};

			if (isEditMode && id) {
				await groupService.update(id, payload);
				toast.success('Zaktualizowano dane grupy!');
			} else {
				const newGroup = await groupService.create(payload);
				toast.success('Utworzono nową grupę!');
				navigate(`/grupy/${newGroup.id}`, { replace: true });
			}
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas zapisywania grupy.');
		} finally {
			setIsSaving(false);
		}
	};

	// ARCHIWIZACJA GRUPY
	const handleArchive = async () => {
		if (!id) return;
		const year = window.prompt('Podaj rok szkolny, do którego chcesz zarchiwizować grupę (np. 2025/2026):');
		if (!year) return; // anulowano lub puste

		if (!window.confirm(`Czy na pewno chcesz zarchiwizować tę grupę do roku ${year}? Grupę oraz uczniów przeniesiemy do historii.`)) return;

		try {
			await groupService.archive(id, year);
			toast.success('Grupa została pomyślnie zarchiwizowana.');
			navigate('/grupy', { replace: true });
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas archiwizacji grupy.');
		}
	};

	// MECHANIKA WYSZUKIWARKI UCZNIÓW
	useEffect(() => {
		const searchStudents = async () => {
			if (searchQuery.length < 3) {
				setSearchResults([]);
				return;
			}

			setIsSearching(true);
			try {
				const results = await studentService.search(searchQuery);
				const filtered = results.filter((s) => s.groupId !== id);
				setSearchResults(filtered);
			} catch (error) {
				console.error(error);
			} finally {
				setIsSearching(false);
			}
		};

		const timeoutId = setTimeout(() => searchStudents(), 500);
		return () => clearTimeout(timeoutId);
	}, [searchQuery, id]);

	const handleAddStudent = async (student: Student) => {
		if (!id) return;
		try {
			await studentService.changeGroup(student.id, id);
			toast.success(`Przypisano: ${student.firstName} ${student.lastName}`);
			setSearchQuery('');
			setSearchResults([]);
			setEnrolledStudents((prev) => [...prev, { ...student, groupId: id, groupName: formData.name }]);
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się przypisać ucznia.');
		}
	};

	const confirmRemoveStudent = async () => {
		if (!studentToRemove || !id) return;
		setIsRemoving(true);

		try {
			if (removeReason === 'midyear') {
				await studentService.changeGroup(studentToRemove.id, null, {
					recordHistory: true,
					isMidYear: true,
					academicYear: systemAcademicYear
				});
			} else {
				await studentService.changeGroup(studentToRemove.id, null, {
					recordHistory: false,
					isMidYear: false
				});
			}

			toast.success('Wypisano ucznia.');
			setEnrolledStudents((prev) => prev.filter((s) => s.id !== studentToRemove.id));
			
			if (removeReason === 'midyear') {
				const history = await studentService.getGroupHistory(id);
				setStudentHistory(history);
			}
			setStudentToRemove(null);
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się wypisać ucznia.');
		} finally {
			setIsRemoving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="animate-pulse p-10 text-center font-bold text-slate-400">Pobieranie konfiguracji panelu...</div>
		);
	}

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			<button
				onClick={() => navigate('/grupy')}
				className="mb-6 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-600"
			>
				<ArrowLeft /> Powrót do listy grup
			</button>

			<div className="flex flex-col gap-8 lg:flex-row">
				{/* LEWA KOLUMNA: DANE GRUPY */}
				<div className="w-full lg:w-1/3 flex flex-col gap-6">
					<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<h2 className="mb-6 text-xl font-bold text-slate-800">{isEditMode ? 'Dane grupy' : 'Utwórz nową grupę'}</h2>
						<form onSubmit={handleSubmit} className="flex flex-col gap-5">
							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Nazwa grupy</label>
								<input
									type="text"
									required
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="w-full rounded-lg border border-slate-300 p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
									placeholder="np. Czwartki 16:00"
								/>
							</div>

							{/* ZMIANA 1: Lista rozwijana Oddziałów */}
							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Oddział / Lokalizacja</label>
								<select
									required
									value={formData.branchId}
									onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
									disabled={branches.length === 1} // Jeśli jest tylko 1 opcja, zablokuj pole
									className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
								>
									<option value="" disabled>
										Wybierz oddział...
									</option>
									{branches.map((b) => (
										<option key={b.id} value={b.id}>
											{b.name}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Główny Prowadzący</label>
								<select
									value={formData.primaryTrainerId || ''}
									onChange={(e) => setFormData({ ...formData, primaryTrainerId: e.target.value })}
									className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								>
									<option value="">Nie przypisano</option>
									{trainers.map((t) => (
										<option key={t.id} value={t.id}>
											{t.firstName} {t.lastName}
										</option>
									))}
								</select>
								<p className="mt-1 text-[10px] text-slate-400">
									Trener automatycznie uzyska dostęp do matrycy tej grupy.
								</p>
							</div>

							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Dedykowany Drukarz (Opcjonalnie)</label>
								<select
									value={formData.assignedPrinterId || ''}
									onChange={(e) => setFormData({ ...formData, assignedPrinterId: e.target.value })}
									className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								>
									<option value="">Nie przypisano (Brak)</option>
									{printers.map((p) => (
										<option key={p.id} value={p.id}>
											{p.firstName} {p.lastName} ({p.email})
										</option>
									))}
								</select>
								<p className="mt-1 text-[10px] text-slate-400">
									Drukarz będzie widział w swoim panelu paczki zlecone z tej grupy.
								</p>
							</div>

							{/* Dzień tygodnia */}
							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Dzień zajęć</label>
								<select
									value={formData.classDayOfWeek === null ? '' : formData.classDayOfWeek}
									onChange={(e) => setFormData({ ...formData, classDayOfWeek: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
									className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								>
									<option value="">Nie wybrano</option>
									<option value="1">Poniedziałek</option>
									<option value="2">Wtorek</option>
									<option value="3">Środa</option>
									<option value="4">Czwartek</option>
									<option value="5">Piątek</option>
									<option value="6">Sobota</option>
									<option value="0">Niedziela</option>
								</select>
							</div>

							<button
								type="submit"
								disabled={isSaving}
								className="mt-2 w-full cursor-pointer rounded-lg bg-blue-600 p-3 font-bold text-white transition-colors hover:bg-blue-700 active:scale-95 disabled:bg-slate-400"
							>
								{isSaving ? 'Zapisywanie...' : 'Zapisz dane'}
							</button>
						</form>
					</div>

					{/* ARCHIWIZACJA GRUPY */}
					{isEditMode && (authService.getCurrentUser()?.role === UserRole.Admin || authService.getCurrentUser()?.role === UserRole.Coordinator) && (
						<div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
							<h3 className="mb-2 text-lg font-bold text-red-700 flex items-center gap-2">
								<ArchiveFill /> Ręczna Archiwizacja
							</h3>
							<p className="mb-4 text-xs text-red-600">
								Grupa zamknęła się przedwcześnie w trakcie roku? Możesz ją zarchiwizować i wypisać uczniów, podając obecny rok szkolny.
							</p>
							<button
								onClick={handleArchive}
								type="button"
								className="w-full rounded-lg bg-red-600 p-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
							>
								Zarchiwizuj Grupę
							</button>
						</div>
					)}
				</div>

				{/* PRAWA KOLUMNA: UCZNIOWIE (Bez zmian strukturalnych) */}
				{isEditMode ? (
					<div className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<h2 className="mb-6 text-xl font-bold text-slate-800">Uczniowie w grupie</h2>

						<button
							onClick={() => navigate(`/uczniowie/masowo?groupId=${id}`)}
							className="flex cursor-pointer items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
						>
							<CloudArrowUpFill /> Masowy import z pliku
						</button>

						<div className="mt-4 mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
							<label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
								<PersonFillAdd className="text-blue-600" /> Wyszukaj i dodaj ucznia
							</label>
							<div className="relative">
								<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Wpisz min. 3 znaki (np. nazwisko)..."
									className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								/>
							</div>

							{searchQuery.length >= 3 && (
								<div className="mt-2 flex max-h-60 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
									{isSearching ? (
										<div className="p-3 text-center text-sm text-slate-500">Szukam w bazie...</div>
									) : searchResults.length === 0 ? (
										<div className="p-3 text-center text-sm text-slate-500">Brak wyników.</div>
									) : (
										searchResults.map((s) => (
											<button
												key={s.id}
												onClick={() => handleAddStudent(s)}
												className="flex cursor-pointer items-center justify-between rounded-md border border-transparent p-3 text-left transition-colors hover:border-blue-100 hover:bg-blue-50"
											>
												<div>
													<span className="font-bold text-slate-800">
														{s.firstName} {s.lastName}
													</span>
													<span className="ml-2 text-xs text-slate-500">(ur. {s.dateOfBirth.substring(0, 4)})</span>
													<div className="mt-1 text-xs text-slate-500">
														{s.groupName ? (
															`Obecnie: ${s.groupName}`
														) : (
															<span className="font-bold text-green-600">Brak przypisanej grupy</span>
														)}
													</div>
												</div>
												<PlusLg className="font-bold text-blue-600" />
											</button>
										))
									)}
								</div>
							)}
						</div>

						{enrolledStudents.length === 0 ? (
							<div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-500">
								Ta grupa nie ma jeszcze żadnych uczniów.
							</div>
						) : (
							<div className="flex flex-col gap-3">
								{enrolledStudents.map((student) => (
									<div
										key={student.id}
										className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-slate-200"
									>
										<div>
											<div className="font-bold text-slate-800">
												{student.firstName} {student.lastName}
											</div>
											<div className="text-xs text-slate-500">Rocznik: {student.dateOfBirth.substring(0, 4)}</div>
										</div>
										<button
											onClick={() => setStudentToRemove(student)}
											className="cursor-pointer rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
										>
											<TrashFill />
										</button>
									</div>
								))}
							</div>
						)}

						{/* HISTORIA UCZNIÓW (WYPISANI / ZARCHIWIZOWANI) */}
						{studentHistory.length > 0 && (
							<div className="mt-8 flex flex-col gap-6">
								{/* 1. Uczniowie zarchiwizowani na koniec roku (TYLKO jeśli grupa jest zarchiwizowana i uczeń ma isMidYear = false) */}
								{isGroupArchived && studentHistory.filter((sh) => !enrolledStudents.some((es) => es.id === sh.studentId) && !sh.isMidYear).length > 0 && (
									<div>
										<h3 className="mb-4 text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
											<ArchiveFill /> Uczniowie zarchiwizowani (Koniec roku)
										</h3>
										<div className="flex flex-col gap-3">
											{studentHistory
												.filter((sh) => !enrolledStudents.some((es) => es.id === sh.studentId) && !sh.isMidYear)
												.map((sh, idx) => (
													<div
														key={`${sh.studentId}-${idx}`}
														className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm opacity-75"
													>
														<div className="font-bold text-slate-700">
															{sh.firstName} {sh.lastName}
														</div>
														<div className="text-xs text-slate-500 mt-1">
															Data operacji: {new Date(sh.archivedAt).toLocaleDateString('pl-PL')} 
															<span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">
																{sh.academicYear}
															</span>
														</div>
													</div>
												))}
										</div>
									</div>
								)}

								{/* 2. Wypisani w trakcie roku (Zawsze jeśli grupa jest aktywna, albo gdy uczeń ma isMidYear = true) */}
								{studentHistory.filter((sh) => !enrolledStudents.some((es) => es.id === sh.studentId) && (!isGroupArchived || sh.isMidYear)).length > 0 && (
									<div>
										<h3 className="mb-4 text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 text-red-600">
											{isGroupArchived ? "Wypisani w trakcie roku" : "Dawni uczniowie (Wypisani w trakcie roku)"}
										</h3>
										<div className="flex flex-col gap-3">
											{studentHistory
												.filter((sh) => !enrolledStudents.some((es) => es.id === sh.studentId) && (!isGroupArchived || sh.isMidYear))
												.map((sh, idx) => (
													<div
														key={`${sh.studentId}-${idx}`}
														className="flex flex-col rounded-lg border border-red-100 bg-red-50 p-4 shadow-sm opacity-90"
													>
														<div className="font-bold text-red-800">
															{sh.firstName} {sh.lastName}
														</div>
														<div className="text-xs text-red-600 mt-1">
															Wypisano: {new Date(sh.archivedAt).toLocaleDateString('pl-PL')} 
															<span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">
																{sh.academicYear}
															</span>
														</div>
													</div>
												))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
						Zapisz dane nowej grupy po lewej stronie, aby odblokować panel zarządzania uczestnikami.
					</div>
				)}
			</div>

			{/* MODAL WYPISYWANIA UCZNIA */}
			{studentToRemove && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<h3 className="mb-2 text-xl font-bold text-slate-800">Wypisanie ucznia z grupy</h3>
						<p className="mb-6 text-sm text-slate-500">
							Określ powód usunięcia ucznia <strong>{studentToRemove.firstName} {studentToRemove.lastName}</strong> z listy.
						</p>

						<div className="mb-6 flex flex-col gap-3">
							<label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-all ${removeReason === 'midyear' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
								<input 
									type="radio" 
									name="removeReason" 
									value="midyear" 
									checked={removeReason === 'midyear'} 
									onChange={() => setRemoveReason('midyear')}
									className="mt-1 accent-blue-600" 
								/>
								<div>
									<div className="font-bold text-slate-800">Wypisanie w trakcie roku</div>
									<div className="mt-1 text-xs text-slate-500">
										Zapis o uczestnictwie trafi do Historii Grupy. Użyjemy globalnego roku: <strong>{systemAcademicYear}</strong>.
									</div>
								</div>
							</label>
							<label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-all ${removeReason === 'mistake' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
								<input 
									type="radio" 
									name="removeReason" 
									value="mistake" 
									checked={removeReason === 'mistake'} 
									onChange={() => setRemoveReason('mistake')}
									className="mt-1 accent-blue-600" 
								/>
								<div>
									<div className="font-bold text-slate-800">Pomyłka / Korekta</div>
									<div className="mt-1 text-xs text-slate-500">
										Uczeń zostanie bezpowrotnie usunięty z tej listy bez pozostawiania śladu w historii.
									</div>
								</div>
							</label>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setStudentToRemove(null)}
								disabled={isRemoving}
								className="flex-1 rounded-xl border border-slate-300 bg-white py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								onClick={confirmRemoveStudent}
								disabled={isRemoving}
								className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white transition-colors hover:bg-red-700"
							>
								{isRemoving ? 'Usuwanie...' : 'Potwierdź'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
