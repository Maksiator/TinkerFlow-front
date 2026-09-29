import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
	ArrowLeft,
	ArrowLeftRight,
	CheckCircleFill,
	ExclamationCircleFill,
	ExclamationTriangleFill,
	ShieldLockFill,
	Search,
	PeopleFill,
	PersonPlusFill,
	CheckLg,
	InfoCircleFill,
} from 'react-bootstrap-icons';
import {
	studentService,
	type Student,
	type StudentRequest,
	type BulkCreateStudentsResponse,
	SkillLevel,
} from '../api/studentService';
import { groupService, type Group } from '../api/groupService';
import { branchService, type Branch } from '../api/branchService';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import toast from 'react-hot-toast';

interface PreviewRow {
	id: string;
	firstName: string;
	lastName: string;
	rawDate: string;
	parsedDate: string;
	isValid: boolean;
	isAlreadyInGroup: boolean;
	isDuplicateInList: boolean;
}

// Funkcja usuwająca CapsLocka i formatująca pierwszą literę
const capitalizeName = (name: string) => {
	if (!name) return '';
	return name
		.split('-') // Uwzględnia nazwiska dwuczłonowe (np. Kowalska-Nowak)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join('-');
};

export function StudentBulkAdd() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const user = authService.getCurrentUser();

	const preselectedGroupId = searchParams.get('groupId');

	const [rawText, setRawText] = useState('');
	const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
	const [selectedGroupId, setSelectedGroupId] = useState<string>(preselectedGroupId || '');
	const [selectedBranchId, setSelectedBranchId] = useState<string>('');
	const [groups, setGroups] = useState<Group[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [groupStudents, setGroupStudents] = useState<Student[]>([]);
	const [isLoadingGroupStudents, setIsLoadingGroupStudents] = useState(false);

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	// Wynik importu (raport po zapisie)
	const [importResult, setImportResult] = useState<BulkCreateStudentsResponse | null>(null);

	// Wyszukiwarka dla oddziału
	const [branchSearch, setBranchSearch] = useState('');
	const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
	const branchDropdownRef = useRef<HTMLDivElement>(null);

	// SPRAWDZENIE UPRAWNIEŃ (RODO/ADMIN)
	const canAccess = user?.role === UserRole.Admin || user?.role === UserRole.Coordinator;

	useEffect(() => {
		let isMounted = true;

		const fetchInitialData = async () => {
			try {
				const [groupsData, branchesData] = await Promise.all([
					groupService.getAll(),
					branchService.getAll(),
				]);
				if (isMounted) {
					setGroups(groupsData);
					setBranches(branchesData);
					if (branchesData.length > 0) {
						setSelectedBranchId(branchesData[0].id);
					}
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error('Błąd pobierania danych startowych.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchInitialData();

		return () => {
			isMounted = false;
		};
	}, []);

	// Pobieranie uczniów z wybranej grupy w celu dynamicznej weryfikacji powtórek
	useEffect(() => {
		if (!selectedGroupId) {
			setGroupStudents([]);
			return;
		}

		let isMounted = true;
		setIsLoadingGroupStudents(true);

		studentService
			.getByGroup(selectedGroupId)
			.then((data) => {
				if (isMounted) {
					setGroupStudents(data);
				}
			})
			.catch((err) => {
				console.error('Błąd pobierania uczniów grupy:', err);
				if (isMounted) {
					setGroupStudents([]);
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsLoadingGroupStudents(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [selectedGroupId]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
				setIsBranchDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	useEffect(() => {
		if (user?.role === UserRole.Coordinator && branches.length > 0) {
			setSelectedBranchId(branches[0].id);
		}
	}, [branches, user]);

	// Funkcja parsująca wiersze tekstu z dynamicznym badaniem powtórek
	const parseLines = (text: string, currentGroupStudents: Student[]): PreviewRow[] => {
		if (!text.trim()) return [];

		const lines = text.split('\n').filter((l) => l.trim().length > 0);
		const seenInList = new Set<string>();

		return lines.map((line, index) => {
			let parts = line.split('\t');
			if (parts.length < 2) parts = line.split(';');
			if (parts.length < 2) parts = line.split(',');

			if (parts.length < 2) {
				const spaceMatch = line.match(/(.+)\s+(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})$/);
				if (spaceMatch) {
					parts = [spaceMatch[1], spaceMatch[2]];
				}
			}

			parts = parts.map((p) => p.trim());

			const fullName = parts[0] || '';
			const rawDate = parts[1] || '';
			const nameParts = fullName.split(' ').filter((n) => n.length > 0);

			const firstNameRaw = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
			const lastNameRaw = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';

			const firstName = capitalizeName(firstNameRaw);
			const lastName = capitalizeName(lastNameRaw);

			let parsedDate = '';
			const dateMatch = rawDate.match(/(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/);
			if (dateMatch) {
				const p1 = dateMatch[1];
				const p2 = dateMatch[2].padStart(2, '0');
				const p3 = dateMatch[3];

				if (p3.length === 4) parsedDate = `${p3}-${p2}-${p1.padStart(2, '0')}`;
				else if (p1.length === 4) parsedDate = `${p1}-${p2}-${p3.padStart(2, '0')}`;
			}

			const hasRawDate = rawDate.length > 0;
			const isValidDate = parsedDate.length === 10;
			const isValid = firstName.length > 0 && lastName.length > 0 && (!hasRawDate || isValidDate);

			// Klucz do porównania
			const key = `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`;

			// Czy uczeń już istnieje w tej grupie w bazie danych
			const isAlreadyInGroup = currentGroupStudents.some(
				(s) =>
					s.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() &&
					s.lastName.trim().toLowerCase() === lastName.trim().toLowerCase()
			);

			// Czy to duplikat wewnątrz samego wklejanego tekstu
			const isDuplicateInList = seenInList.has(key);
			if (isValid) {
				seenInList.add(key);
			}

			return {
				id: `row-${index}`,
				firstName,
				lastName,
				rawDate,
				parsedDate,
				isValid,
				isAlreadyInGroup,
				isDuplicateInList,
			};
		});
	};

	// Aktualizacja podglądu przy zmianie tekstu lub zmianie listy uczniów grupy
	useEffect(() => {
		setPreviewRows(parseLines(rawText, groupStudents));
	}, [rawText, groupStudents]);

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setRawText(e.target.value);
	};

	const swapNames = (rowId: string) => {
		setPreviewRows((prev) => {
			const updated = prev.map((row) => {
				if (row.id === rowId) {
					return { ...row, firstName: row.lastName, lastName: row.firstName };
				}
				return row;
			});

			// Przelicz powtórki po zamianie
			const seenInList = new Set<string>();
			return updated.map((row) => {
				const key = `${row.firstName.trim().toLowerCase()}_${row.lastName.trim().toLowerCase()}`;
				const isAlreadyInGroup = groupStudents.some(
					(s) =>
						s.firstName.trim().toLowerCase() === row.firstName.trim().toLowerCase() &&
						s.lastName.trim().toLowerCase() === row.lastName.trim().toLowerCase()
				);
				const isDuplicateInList = seenInList.has(key);
				if (row.isValid) {
					seenInList.add(key);
				}
				return {
					...row,
					isAlreadyInGroup,
					isDuplicateInList,
				};
			});
		});
	};

	// Statystyki podglądu
	const stats = useMemo(() => {
		const toAdd = previewRows.filter((r) => r.isValid && !r.isAlreadyInGroup && !r.isDuplicateInList);
		const inGroup = previewRows.filter((r) => r.isValid && r.isAlreadyInGroup);
		const duplicateInList = previewRows.filter((r) => r.isValid && !r.isAlreadyInGroup && r.isDuplicateInList);
		const invalid = previewRows.filter((r) => !r.isValid);

		return {
			toAddCount: toAdd.length,
			inGroupCount: inGroup.length,
			duplicateInListCount: duplicateInList.length,
			invalidCount: invalid.length,
			toAddRows: toAdd,
		};
	}, [previewRows]);

	const handleSubmit = async () => {
		if (stats.invalidCount > 0) {
			toast.error(`Masz ${stats.invalidCount} błędnych wierszy. Popraw je w polu po lewej.`);
			return;
		}

		if (selectedGroupId === '' && !selectedBranchId) {
			toast.error('Wybierz oddział, do którego chcesz zaimportować uczniów bez grupy.');
			return;
		}

		if (stats.toAddCount === 0) {
			toast.error('Wszyscy uczniowie z listy są już w tej grupie lub są zduplikowani!');
			return;
		}

		setIsSaving(true);
		try {
			// Wysyłamy tylko tych uczniów, którzy są nowi
			const payload: StudentRequest[] = stats.toAddRows.map((row) => ({
				firstName: row.firstName,
				lastName: row.lastName,
				dateOfBirth: row.parsedDate ? row.parsedDate : null,
				level: SkillLevel.Beginner,
				isIndependent: false,
				needsAttention: false,
				groupId: selectedGroupId === '' ? null : selectedGroupId,
				branchId: selectedGroupId === '' ? (selectedBranchId === '' ? null : selectedBranchId) : null,
			}));

			const res = await studentService.createBulk(payload);

			// Dołączamy do raportu pominiętych z weryfikacji frontowej
			const combinedSkipped = [
				...res.skippedStudents,
				...previewRows
					.filter((r) => r.isValid && (r.isAlreadyInGroup || r.isDuplicateInList))
					.map((r) => `${r.firstName} ${r.lastName}`),
			];
			const uniqueSkipped = Array.from(new Set(combinedSkipped));

			setImportResult({
				message: res.message,
				addedCount: res.addedCount,
				skippedCount: uniqueSkipped.length,
				addedStudents: res.addedStudents,
				skippedStudents: uniqueSkipped,
			});

			toast.success(`Pomyślnie dodano ${res.addedCount} nowych uczniów!`);
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas masowego dodawania.');
		} finally {
			setIsSaving(false);
		}
	};

	// BLOKADA DOSTĘPU DLA TRENERA
	if (!canAccess && !isLoading) {
		return (
			<div className="flex flex-col items-center justify-center p-20 text-center">
				<ShieldLockFill size={64} className="mb-4 text-red-500" />
				<h1 className="text-2xl font-bold text-slate-800">Brak uprawnień</h1>
				<p className="text-slate-500">Tylko Administrator lub Koordynator może przeprowadzać masowy import uczniów.</p>
				<button onClick={() => navigate('/uczniowie')} className="mt-6 font-bold text-blue-600 hover:underline">
					Wróć do bazy
				</button>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
			{/* MODAL RAPORTU PO ZAKOŃCZENIU IMPORTU */}
			{importResult && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
					<div className="animate-in fade-in zoom-in-95 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl duration-200">
						<div className="mb-4 flex items-center gap-3 text-green-600">
							<CheckCircleFill size={32} />
							<h3 className="text-xl font-bold text-slate-800">Raport z importu</h3>
						</div>

						<p className="mb-4 text-sm text-slate-600">
							Proces importu został zakończony. Oto dokładne zestawienie przetworzonych danych:
						</p>

						<div className="space-y-4">
							{/* Dodani uczniowie */}
							<div className="rounded-xl border border-green-200 bg-green-50/70 p-4">
								<div className="flex items-center justify-between text-xs font-bold text-green-800 uppercase">
									<span>Dodani nowi uczniowie</span>
									<span className="rounded-full bg-green-200 px-2 py-0.5 text-green-900">
										{importResult.addedCount}
									</span>
								</div>
								{importResult.addedStudents.length > 0 ? (
									<div className="mt-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
										{importResult.addedStudents.map((name, i) => (
											<span
												key={i}
												className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-semibold text-green-900 shadow-xs border border-green-200"
											>
												<CheckLg size={12} className="text-green-600" /> {name}
											</span>
										))}
									</div>
								) : (
									<p className="mt-1 text-xs text-green-700 italic">Żaden uczeń nie został dodany.</p>
								)}
							</div>

							{/* Pominięte powtórki */}
							{importResult.skippedCount > 0 && (
								<div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
									<div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase">
										<span>Pominięto (duplikaty / już w grupie)</span>
										<span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-900">
											{importResult.skippedCount}
										</span>
									</div>
									<div className="mt-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
										{importResult.skippedStudents.map((name, i) => (
											<span
												key={i}
												className="rounded bg-white px-2 py-1 text-xs font-medium text-amber-900 shadow-xs border border-amber-200"
											>
												{name}
											</span>
										))}
									</div>
								</div>
							)}
						</div>

						<div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
							<button
								onClick={() => {
									setImportResult(null);
									setRawText('');
									setPreviewRows([]);
								}}
								className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
							>
								Wklej kolejną listę
							</button>
							{selectedGroupId ? (
								<button
									onClick={() => navigate(`/grupy/${selectedGroupId}`)}
									className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
								>
									Przejdź do grupy
								</button>
							) : (
								<button
									onClick={() => navigate('/uczniowie')}
									className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
								>
									Przejdź do bazy uczniów
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			<button
				onClick={() => (selectedGroupId ? navigate(`/grupy/${selectedGroupId}`) : navigate('/uczniowie'))}
				className="mb-6 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-600"
			>
				<ArrowLeft /> {selectedGroupId ? 'Powrót do grupy' : 'Powrót do bazy'}
			</button>

			<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 className="mb-2 text-2xl font-bold text-slate-800">Masowy import uczniów</h1>
				<p className="mb-4 text-slate-500">
					Wklej dane prosto z Excela lub ActiveNow. System na bieżąco analizuje listę, porównuje z bazą i informuje o powtórkach.
				</p>

				{/* RAMKA Z PREFEROWANYM FORMATEM DANYCH */}
				<div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-950 shadow-2xs">
					<div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1.5">
						<InfoCircleFill className="text-blue-600 shrink-0" size={15} />
						<span className="text-sm">Format wprowadzania danych:</span>
					</div>
					<p className="font-medium text-slate-700 mb-2">
						Wpisz lub skopiuj każdego ucznia w nowej linii według wzoru: <strong className="text-slate-900">Nazwisko Imię [separator] Data urodzenia</strong> <span className="text-blue-700 font-normal">(data urodzenia jest opcjonalna – możesz wkleić samo imię i nazwisko)</span>.
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-blue-200/70 text-slate-800">
						<div className="flex flex-col gap-0.5">
							<span className="font-bold text-blue-900">📅 Format daty urodzenia (opcjonalny):</span>
							<div className="flex items-center gap-2 mt-0.5">
								<code className="rounded bg-white px-2 py-1 font-bold text-blue-700 border border-blue-200 shadow-2xs">
									RRRR-MM-DD
								</code>
								<span className="text-slate-500 font-medium">np. 2015-05-20</span>
							</div>
							<div className="flex items-center gap-2 mt-0.5">
								<code className="rounded bg-white px-2 py-1 font-bold text-blue-700 border border-blue-200 shadow-2xs">
									DD.MM.RRRR
								</code>
								<span className="text-slate-500 font-medium">np. 20.05.2015</span>
							</div>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="font-bold text-blue-900">✂️ Dozwolone separatory:</span>
							<p className="text-slate-600 mt-0.5">
								Tabulator (kopiowanie kolumn z Excela), przecinek <code>,</code>, średnik <code>;</code> lub po prostu spacja między nazwiskiem a datą.
							</p>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
					{/* LEWA KOLUMNA: Formularz i wklejanie */}
					<div className="flex flex-col gap-4">
						<div>
							<label className="mb-2 block text-sm font-bold text-slate-700">Skopiuj i wklej tabelę:</label>
							<textarea
								value={rawText}
								onChange={handleTextChange}
								className="h-80 w-full rounded-lg border border-slate-300 p-4 font-mono text-sm leading-relaxed transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								placeholder="Kowalska Anna, 2015-05-20&#10;Nowak Jan, 12.10.2014&#10;Lis Piotr; 2016-01-15&#10;Wiśniewski Adam 2013-09-04"
							/>
						</div>

						<div>
							<label className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700">
								<span>Przypisz od razu do grupy:</span>
								{isLoadingGroupStudents && (
									<span className="text-xs font-normal text-blue-600">Weryfikowanie grupy...</span>
								)}
							</label>
							<select
								value={selectedGroupId}
								onChange={(e) => setSelectedGroupId(e.target.value)}
								className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1"
							>
								<option value="">Nie przypisuj do żadnej grupy</option>
								{groups.map((g) => (
									<option key={g.id} value={g.id}>
										{g.name} ({g.branchName})
									</option>
								))}
							</select>
							{selectedGroupId && groupStudents.length > 0 && (
								<p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
									<PeopleFill size={13} className="text-blue-600" />
									Obecnie w tej grupie w bazie: <strong>{groupStudents.length} uczniów</strong>.
								</p>
							)}
						</div>

						{selectedGroupId === '' && (
							user?.role === UserRole.Coordinator ? (
								<div>
									<label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Oddział</label>
									<input
										type="text"
										value={branches.find(b => b.id === selectedBranchId)?.name || 'Pobieranie oddziału...'}
										disabled
										className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-400 outline-none cursor-not-allowed font-medium"
									/>
								</div>
							) : (
								<div className="relative" ref={branchDropdownRef}>
									<label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Wybierz oddział (wymagany):</label>
									<div className="relative">
										<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
										<input
											type="text"
											placeholder="Wyszukaj oddział..."
											value={branchSearch || (selectedBranchId ? branches.find(b => b.id === selectedBranchId)?.name || '' : '')}
											onChange={(e) => {
												setBranchSearch(e.target.value);
												if (e.target.value === '') setSelectedBranchId('');
												setIsBranchDropdownOpen(true);
											}}
											onFocus={() => {
												setIsBranchDropdownOpen(true);
												setBranchSearch('');
											}}
											className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-sm outline-none focus:border-blue-500 focus:ring-1"
										/>
									</div>
									
									{isBranchDropdownOpen && (
										<div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
											{branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase())).length === 0 ? (
												<div className="p-3 text-sm text-slate-500">Brak wyników</div>
											) : (
												branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase())).map(b => (
													<div
														key={b.id}
														onClick={() => {
															setSelectedBranchId(b.id);
															setBranchSearch('');
															setIsBranchDropdownOpen(false);
														}}
														className="cursor-pointer border-b border-slate-100 p-3 text-sm hover:bg-slate-50 last:border-0 font-medium"
													>
														{b.name}
													</div>
												))
											)}
										</div>
									)}
								</div>
							)
						)}
					</div>

					{/* PRAWA KOLUMNA: Dynamiczny podgląd i statystyki */}
					<div className="flex h-full flex-col">
						<label className="mb-2 block text-sm font-bold text-slate-700">Dynamiczny podgląd weryfikacji:</label>

						{/* LICZNIKI STATYSTYK W CZASIE RZECZYWISTYM */}
						{previewRows.length > 0 && (
							<div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
								<div className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-800">
									<div className="text-lg font-extrabold">{stats.toAddCount}</div>
									<div className="font-bold">Do dodania</div>
								</div>
								<div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
									<div className="text-lg font-extrabold">{stats.inGroupCount}</div>
									<div className="font-bold">Już w grupie</div>
								</div>
								<div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-orange-800">
									<div className="text-lg font-extrabold">{stats.duplicateInListCount}</div>
									<div className="font-bold">Duplikat listy</div>
								</div>
								<div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-800">
									<div className="text-lg font-extrabold">{stats.invalidCount}</div>
									<div className="font-bold">Błędny format</div>
								</div>
							</div>
						)}

						<div className="w-full max-w-full min-h-80 flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50">
							{previewRows.length === 0 ? (
								<div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
									Wklej tekst po lewej stronie, aby zobaczyć dynamiczne porównanie.
								</div>
							) : (
								<table className="w-full text-left text-sm">
									<thead className="sticky top-0 bg-slate-200 text-slate-600 shadow-sm text-xs font-bold uppercase">
										<tr>
											<th className="p-3">Weryfikacja</th>
											<th className="p-3">Uczeń</th>
											<th className="p-3">Data</th>
										</tr>
									</thead>
									<tbody>
										{previewRows.map((row) => (
											<tr
												key={row.id}
												className={`border-b border-slate-100 transition-colors ${
													!row.isValid
														? 'bg-red-50/70 hover:bg-red-100/50'
														: row.isAlreadyInGroup
														? 'bg-amber-50/60 hover:bg-amber-100/50'
														: row.isDuplicateInList
														? 'bg-orange-50/60 hover:bg-orange-100/50'
														: 'bg-white hover:bg-slate-50'
												}`}
											>
												<td className="p-3">
													{!row.isValid ? (
														<span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
															<ExclamationCircleFill size={12} /> Błąd
														</span>
													) : row.isAlreadyInGroup ? (
														<span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800" title="Uczeń już jest w tej grupie, zostanie pominięty">
															<ExclamationTriangleFill size={12} /> Już w grupie
														</span>
													) : row.isDuplicateInList ? (
														<span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800" title="Ta osoba pojawiła się wcześniej na tej samej liście">
															<ExclamationTriangleFill size={12} /> Duplikat listy
														</span>
													) : (
														<span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">
															<CheckCircleFill size={12} /> Nowy
														</span>
													)}
												</td>
												<td className="p-3">
													<div className="flex items-center gap-2">
														<span className={`font-semibold ${row.isAlreadyInGroup ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
															{row.firstName}
														</span>
														<span className={row.isAlreadyInGroup ? 'text-slate-500 line-through' : 'text-slate-700'}>
															{row.lastName}
														</span>
														<button
															onClick={() => swapNames(row.id)}
															className="cursor-pointer rounded border border-slate-200 bg-slate-100 p-1 text-xs text-slate-500 transition-colors hover:text-blue-600"
															title="Zamień imię z nazwiskiem"
														>
															<ArrowLeftRight size={10} />
														</button>
													</div>
												</td>
												<td className="p-3">
													{row.isValid ? (
														row.parsedDate ? (
															<span className="font-mono text-xs font-semibold text-slate-600">{row.parsedDate}</span>
														) : (
															<span className="text-xs font-medium text-amber-700 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
																Brak daty
															</span>
														)
													) : (
														<div className="text-xs font-mono text-red-500">"{row.rawDate}"</div>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>

						<div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
							<div className="text-xs text-slate-500">
								{previewRows.length > 0 && (
									<span>
										Razem wklejono: <strong>{previewRows.length}</strong> osób | Do dodania: <strong className="text-green-600">{stats.toAddCount}</strong>
									</span>
								)}
							</div>

							<button
								onClick={handleSubmit}
								disabled={isSaving || previewRows.length === 0 || stats.invalidCount > 0 || stats.toAddCount === 0}
								className="w-full sm:w-auto cursor-pointer rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 flex items-center justify-center gap-2"
							>
								<PersonPlusFill size={18} />
								{isSaving
									? 'Zapisywanie...'
									: stats.toAddCount === 0 && previewRows.length > 0
									? 'Wszyscy uczniowie są już w grupie'
									: `Dodaj ${stats.toAddCount} nowych uczniów`}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
