import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupService, type CreateGroup, GroupType } from '../api/groupService';
import { studentService, type Student, type StudentHistoryItem, SkillLevel } from '../api/studentService';
import { branchService, type Branch } from '../api/branchService';
import { userService, type User, UserRole } from '../api/userService';
import { systemSettingsService } from '../api/systemSettingsService';
import {
	ArrowLeft,
	PlusLg,
	TrashFill,
	Search,
	PersonFillAdd,
	CloudArrowUpFill,
	ArchiveFill,
	ArrowLeftRight,
	XCircleFill,
	PersonPlusFill,
} from 'react-bootstrap-icons';
import toast from 'react-hot-toast';
import { authService } from '../api/authService';
import { TransferStudentModal } from '../components/TransferStudentModal';
import { CustomSelect } from '../components/CustomSelect';

export function GroupForm() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const isEditMode = Boolean(id) && id !== 'nowa';

	// --- STAN: DANE GRUPY I LISTY WYBORU ---
	const [formData, setFormData] = useState<CreateGroup>({ name: '', branchId: '', primaryTrainerId: null, assignedPrinterId: null, classDayOfWeek: null, type: GroupType.Standard });
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
	const [studentToTransfer, setStudentToTransfer] = useState<Student | null>(null);
	const [removeReason, setRemoveReason] = useState<'midyear' | 'mistake'>('midyear');
	const [isRemoving, setIsRemoving] = useState(false);

	// --- STAN: POJEDYNCZE DODAWANIE UCZNIA ---
	const [isAddSingleStudentModalOpen, setIsAddSingleStudentModalOpen] = useState(false);
	const [isAddingSingleStudent, setIsAddingSingleStudent] = useState(false);
	const [singleStudentData, setSingleStudentData] = useState<{
		firstName: string;
		lastName: string;
		dateOfBirth: string;
		level: SkillLevel;
		isIndependent: boolean;
		needsAttention: boolean;
	}>({
		firstName: '',
		lastName: '',
		dateOfBirth: '',
		level: SkillLevel.Beginner,
		isIndependent: false,
		needsAttention: false,
	});

	// Dynamiczne filtrowanie trenerów dla wybranego oddziału
	const availableTrainers = useMemo(() => {
		if (!formData.branchId) return [];
		return trainers.filter((t) => {
			if (t.id === formData.primaryTrainerId) return true;
			if (t.role === UserRole.Admin) return true;
			return t.branches && t.branches.some((b) => b.branchId === formData.branchId);
		});
	}, [trainers, formData.branchId, formData.primaryTrainerId]);

	const handleBranchChange = (newBranchId: string) => {
		setFormData((prev) => {
			const branchTrainers = trainers.filter(
				(t) =>
					t.role === UserRole.Admin ||
					(t.branches && t.branches.some((b) => b.branchId === newBranchId))
			);
			const isCurrentTrainerValid =
				prev.primaryTrainerId &&
				branchTrainers.some((t) => t.id === prev.primaryTrainerId);

			return {
				...prev,
				branchId: newBranchId,
				primaryTrainerId: isCurrentTrainerValid ? prev.primaryTrainerId : null,
			};
		});
	};

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
							type: group.type ?? GroupType.Standard,
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

				// Wyłuskujemy tylko tych, którzy mogą prowadzić zajęcia (Trenerzy, Koordynatorzy oraz Administrator jeśli włączył tę opcję)
				const availableTrainers = fetchedUsers.filter(
					(u: User) =>
						u.role === UserRole.Trainer ||
						u.role === UserRole.Coordinator ||
						(u.role === UserRole.Admin && u.canActAsTrainer),
				);

				// Wyłuskujemy drukarzy (Drukarze oraz Trenerzy z uprawnieniem drukarza)
				const availablePrinters = fetchedUsers.filter(
					(u: User) => u.role === UserRole.Printer || (u.role === UserRole.Trainer && !!u.canActAsPrinter),
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

		if (!formData.name.trim()) {
			toast.error('Podaj nazwę grupy!');
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

	const handleAddSingleStudent = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!id) return;
		if (!singleStudentData.firstName.trim() || !singleStudentData.lastName.trim()) {
			toast.error('Wypełnij imię i nazwisko ucznia.');
			return;
		}

		setIsAddingSingleStudent(true);
		try {
			const created = await studentService.create({
				firstName: singleStudentData.firstName.trim(),
				lastName: singleStudentData.lastName.trim(),
				dateOfBirth: singleStudentData.dateOfBirth.trim() ? singleStudentData.dateOfBirth.trim() : null,
				level: singleStudentData.level,
				isIndependent: singleStudentData.isIndependent,
				needsAttention: singleStudentData.needsAttention,
				groupId: id,
				branchId: formData.branchId,
			});
			setEnrolledStudents((prev) => [...prev, created]);
			toast.success(`Dodano ucznia ${created.firstName} ${created.lastName} do grupy!`);
			setIsAddSingleStudentModalOpen(false);
			setSingleStudentData({
				firstName: '',
				lastName: '',
				dateOfBirth: '',
				level: SkillLevel.Beginner,
				isIndependent: false,
				needsAttention: false,
			});
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas dodawania ucznia do grupy.');
		} finally {
			setIsAddingSingleStudent(false);
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
		<div className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
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
							{/* 1. ODDZIAŁ / LOKALIZACJA - WYBIERANY NAJPIERW */}
							<CustomSelect
								label="Oddział / Lokalizacja"
								required
								color="blue"
								searchable={branches.length > 5}
								value={formData.branchId}
								onChange={handleBranchChange}
								disabled={branches.length === 1}
								placeholder="Wybierz oddział..."
								options={branches.map((b) => ({
									value: b.id,
									label: b.name,
								}))}
								helperText={
									branches.length === 1
										? 'Twój jedyny przypisany oddział (wybrany automatycznie).'
										: undefined
								}
							/>

							{/* 2. NAZWA GRUPY */}
							<div>
								<label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
									Nazwa grupy <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									required
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
									placeholder="np. Czwartki 16:00"
								/>
							</div>

							{/* 3. GŁÓWNY PROWADZĄCY - DYNAMICZNIE FILTROWANI TRENERZY DLA ODDZIAŁU */}
							<CustomSelect
								label="Główny Prowadzący (Trener)"
								color="blue"
								searchable={availableTrainers.length > 5}
								disabled={!formData.branchId}
								value={formData.primaryTrainerId || ''}
								onChange={(val) => setFormData({ ...formData, primaryTrainerId: val || null })}
								placeholder={
									!formData.branchId
										? 'Najpierw wybierz oddział...'
										: availableTrainers.length === 0
										? 'Brak trenerów w tym oddziale'
										: 'Wybierz prowadzącego...'
								}
								options={[
									{ value: '', label: 'Nie przypisano' },
									...availableTrainers.map((t) => ({
										value: t.id,
										label: `${t.firstName} ${t.lastName}`,
										sublabel: t.role === UserRole.Admin ? 'Administrator' : undefined,
									})),
								]}
								helperText={
									!formData.branchId
										? 'Wybierz oddział powyżej, aby zobaczyć przypisanych do niego trenerów.'
										: availableTrainers.length === 0
										? 'Brak aktywnych trenerów przypisanych do tego oddziału.'
										: `Dostępni trenerzy w tym oddziale (${availableTrainers.length}). Uzyska dostęp do matrycy.`
								}
							/>

							{/* 4. DEDYKOWANY DRUKARZ (OPCJONALNIE) */}
							<CustomSelect
								label="Dedykowany Drukarz (Opcjonalnie)"
								color="blue"
								searchable={printers.length > 5}
								value={formData.assignedPrinterId || ''}
								onChange={(val) => setFormData({ ...formData, assignedPrinterId: val || null })}
								placeholder="Wybierz drukarza..."
								options={[
									{ value: '', label: 'Nie przypisano (Brak)' },
									...printers.map((p) => ({
										value: p.id,
										label: `${p.firstName} ${p.lastName}${p.role === UserRole.Trainer ? ' (Trener)' : ''}`,
										sublabel: p.email,
									})),
								]}
								helperText="Drukarz będzie widział w swoim panelu paczki zlecone z tej grupy."
							/>

							{/* 5. DZIEŃ ZAJĘĆ */}
							<CustomSelect
								label="Dzień zajęć"
								color="blue"
								value={formData.classDayOfWeek === null || formData.classDayOfWeek === undefined ? '' : String(formData.classDayOfWeek)}
								onChange={(val) => setFormData({ ...formData, classDayOfWeek: val === '' ? null : parseInt(val, 10) })}
								placeholder="Wybierz dzień..."
								options={[
									{ value: '', label: 'Nie wybrano' },
									{ value: '1', label: 'Poniedziałek' },
									{ value: '2', label: 'Wtorek' },
									{ value: '3', label: 'Środa' },
									{ value: '4', label: 'Czwartek' },
									{ value: '5', label: 'Piątek' },
									{ value: '6', label: 'Sobota' },
									{ value: '0', label: 'Niedziela' },
								]}
							/>

							{/* 6. TYLKO DLA ADMINA: Checkbox grupy zaawansowanej */}
							{authService.getCurrentUser()?.role === UserRole.Admin && (
								<label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-purple-200 bg-purple-50/60 p-3 select-none hover:bg-purple-50 transition-colors">
									<input
										type="checkbox"
										id="groupTypeCheckbox"
										checked={formData.type === GroupType.Advanced}
										onChange={(e) =>
											setFormData({
												...formData,
												type: e.target.checked ? GroupType.Advanced : GroupType.Standard,
											})
										}
										className="h-4 w-4 cursor-pointer rounded border-purple-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="text-xs font-bold text-purple-900">
										Grupa zaawansowana <span className="font-normal text-purple-700">(SolidWorks + własny tok nauczania)</span>
									</span>
								</label>
							)}

							<button
								type="submit"
								disabled={isSaving}
								className="mt-2 w-full cursor-pointer rounded-xl bg-blue-600 p-3 font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 disabled:bg-slate-400 disabled:cursor-not-allowed"
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
						<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div>
								<h2 className="text-xl font-bold text-slate-800">Uczniowie w grupie</h2>
								<p className="text-xs text-slate-500 font-medium">Liczba uczniów: {enrolledStudents.length}</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => setIsAddSingleStudentModalOpen(true)}
									className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
								>
									<PersonPlusFill size={14} /> Dodaj pojedynczego ucznia
								</button>
								<button
									type="button"
									onClick={() => navigate(`/uczniowie/masowo?groupId=${id}`)}
									className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
								>
									<CloudArrowUpFill size={14} /> Masowy import z pliku
								</button>
							</div>
						</div>

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
													<span className="ml-2 text-xs text-slate-500">
														{s.dateOfBirth ? `(ur. ${s.dateOfBirth.substring(0, 4)})` : '(brak daty)'}
													</span>
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
											<div className="text-xs text-slate-500">
												{student.dateOfBirth ? (
													`Rocznik: ${student.dateOfBirth.substring(0, 4)}`
												) : (
													<span className="font-semibold text-amber-600">Brak daty urodzenia</span>
												)}
											</div>
										</div>
										<div className="flex items-center gap-1.5">
											<button
												type="button"
												onClick={() => setStudentToTransfer(student)}
												className="cursor-pointer rounded-lg bg-slate-50 p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
												title="Przepisz ucznia do innej grupy"
											>
												<ArrowLeftRight />
											</button>
											<button
												type="button"
												onClick={() => setStudentToRemove(student)}
												className="cursor-pointer rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
												title="Wypisz ucznia z grupy"
											>
												<TrashFill />
											</button>
										</div>
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
								currentGroupId: id,
								currentGroupName: formData.name,
						  }
						: null
				}
				onSuccess={async () => {
					if (id) {
						const [students, hist] = await Promise.all([
							studentService.getByGroup(id),
							studentService.getGroupHistory(id),
						]);
						setEnrolledStudents(students);
						setStudentHistory(hist);
					}
				}}
			/>

			{/* MODAL POJEDYNCZEGO DODAWANIA UCZNIA */}
			{isAddSingleStudentModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs transition-opacity">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
							<div>
								<h3 className="text-lg font-bold text-slate-800">Dodaj ucznia do grupy</h3>
								<p className="text-xs text-slate-500 font-medium mt-0.5">
									Grupa: <span className="font-bold text-purple-600">{formData.name}</span>
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsAddSingleStudentModalOpen(false)}
								className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
							>
								<XCircleFill size={20} />
							</button>
						</div>

						<form onSubmit={handleAddSingleStudent} className="space-y-4">
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="mb-1 block text-xs font-bold text-slate-700">Imię *</label>
									<input
										type="text"
										required
										value={singleStudentData.firstName}
										onChange={(e) => setSingleStudentData({ ...singleStudentData, firstName: e.target.value })}
										placeholder="np. Jan"
										className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-bold text-slate-700">Nazwisko *</label>
									<input
										type="text"
										required
										value={singleStudentData.lastName}
										onChange={(e) => setSingleStudentData({ ...singleStudentData, lastName: e.target.value })}
										placeholder="np. Kowalski"
										className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
									/>
								</div>
							</div>

							<div>
								<label className="mb-1 block text-xs font-bold text-slate-700">Data urodzenia (opcjonalnie)</label>
								<input
									type="date"
									value={singleStudentData.dateOfBirth}
									onChange={(e) => setSingleStudentData({ ...singleStudentData, dateOfBirth: e.target.value })}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
								/>
							</div>

							<div>
								<label className="mb-1 block text-xs font-bold text-slate-700">Poziom zaawansowania</label>
								<select
									value={singleStudentData.level}
									onChange={(e) => setSingleStudentData({ ...singleStudentData, level: Number(e.target.value) as SkillLevel })}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white"
								>
									<option value={SkillLevel.Beginner}>Początkujący</option>
									<option value={SkillLevel.Intermediate}>Średniozaawansowany</option>
									<option value={SkillLevel.Advanced}>Zaawansowany</option>
								</select>
							</div>

							<div className="space-y-2 pt-1">
								<label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
									<input
										type="checkbox"
										checked={singleStudentData.isIndependent}
										onChange={(e) => setSingleStudentData({ ...singleStudentData, isIndependent: e.target.checked })}
										className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
									/>
									<span>Pracuje samodzielnie (oznaczenie gwiazdką)</span>
								</label>
								<label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
									<input
										type="checkbox"
										checked={singleStudentData.needsAttention}
										onChange={(e) => setSingleStudentData({ ...singleStudentData, needsAttention: e.target.checked })}
										className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
									/>
									<span>Wymaga szczególnej uwagi / pomocy trenera</span>
								</label>
							</div>

							<div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
								<button
									type="button"
									onClick={() => setIsAddSingleStudentModalOpen(false)}
									disabled={isAddingSingleStudent}
									className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
								>
									Anuluj
								</button>
								<button
									type="submit"
									disabled={isAddingSingleStudent}
									className="cursor-pointer rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
								>
									{isAddingSingleStudent ? 'Dodawanie...' : 'Dodaj ucznia'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
