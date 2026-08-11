import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
	ArrowLeft,
	ArrowLeftRight,
	CheckCircleFill,
	ExclamationCircleFill,
	ShieldLockFill,
	Search,
} from 'react-bootstrap-icons';
import { studentService, type StudentRequest, SkillLevel } from '../api/studentService';
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
}

// NOWE: Magiczna funkcja usuwająca CapsLocka i formatująca pierwszą literę
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
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

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
					branchService.getAll()
				]);
				if (isMounted) {
					setGroups(groupsData);
					setBranches(branchesData);
					// Domyślnie zaznacz pierwszy oddział, jeśli koordynator/admin ma dostęp
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

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newText = e.target.value;
		setRawText(newText);

		if (!newText.trim()) {
			setPreviewRows([]);
			return;
		}

		const lines = newText.split('\n').filter((l) => l.trim().length > 0);
		const parsed: PreviewRow[] = lines.map((line, index) => {
			// Próba podziału po tabulatorze (standard przy wklejaniu z Excela), średniku lub przecinku
			let parts = line.split('\t');
			if (parts.length < 2) parts = line.split(';');
			if (parts.length < 2) parts = line.split(',');

			// Jeśli wciąż nie podzieliło (bo np. ktoś wkleił spacje), dzielimy po ostatniej grupie spacji przed datą
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

			// ZMIANA: Owijamy wyniki funkcją capitalizeName
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

			const isValid = firstName.length > 0 && lastName.length > 0 && parsedDate.length === 10;

			return { id: `row-${index}`, firstName, lastName, rawDate, parsedDate, isValid };
		});

		setPreviewRows(parsed);
	};

	const swapNames = (rowId: string) => {
		setPreviewRows((prev) =>
			prev.map((row) => {
				if (row.id === rowId) {
					return { ...row, firstName: row.lastName, lastName: row.firstName };
				}
				return row;
			}),
		);
	};

	const handleSubmit = async () => {
		const invalidCount = previewRows.filter((r) => !r.isValid).length;
		if (invalidCount > 0) {
			toast.error(`Masz ${invalidCount} błędnych wierszy. Popraw je w polu po lewej.`);
			return;
		}

		if (selectedGroupId === '' && !selectedBranchId) {
			toast.error('Wybierz oddział, do którego chcesz zaimportować uczniów bez grupy.');
			return;
		}

		setIsSaving(true);
		try {
			const payload: StudentRequest[] = previewRows.map((row) => ({
				firstName: row.firstName,
				lastName: row.lastName,
				dateOfBirth: row.parsedDate,
				level: SkillLevel.Beginner,
				isIndependent: false,
				needsAttention: false,
				groupId: selectedGroupId === '' ? null : selectedGroupId,
				branchId: selectedGroupId === '' ? (selectedBranchId === '' ? null : selectedBranchId) : null,
			}));

			await studentService.createBulk(payload);
			toast.success(`Pomyślnie zaimportowano ${payload.length} uczniów!`);

			// Powrót do grupy, jeśli weszliśmy stamtąd
			if (selectedGroupId) {
				navigate(`/grupy/${selectedGroupId}`);
			} else {
				navigate('/uczniowie');
			}
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
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			<button
				onClick={() => (selectedGroupId ? navigate(`/grupy/${selectedGroupId}`) : navigate('/uczniowie'))}
				className="mb-6 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-600"
			>
				<ArrowLeft /> {selectedGroupId ? 'Powrót do grupy' : 'Powrót do bazy'}
			</button>

			<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 className="mb-2 text-2xl font-bold text-slate-800">Masowy import uczniów</h1>
				<p className="mb-6 text-slate-500">
					Wklej dane prosto z Excela lub ActiveNow. Format: <strong>Nazwisko Imię, Data urodzenia</strong>.
				</p>

				<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<div className="flex flex-col gap-4">
						<div>
							<label className="mb-2 block text-sm font-bold text-slate-700">Skopiuj i wklej tabelę:</label>
							<textarea
								value={rawText}
								onChange={handleTextChange}
								className="h-80 w-full rounded-lg border border-slate-300 p-4 font-mono text-sm leading-relaxed transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								placeholder="Kowalska Anna, 15.10.2015&#10;Lis Jan; 2014-05-12&#10;NOWAK PIOTR 2012-01-01"
							/>
						</div>

						<div>
							<label className="mb-2 block text-sm font-bold text-slate-700">Przypisz od razu do grupy:</label>
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

					<div className="flex h-full flex-col">
						<label className="mb-2 block text-sm font-bold text-slate-700">Podgląd systemu:</label>
						<div className="min-h-80 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
							{previewRows.length === 0 ? (
								<div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
									Tabela pojawi się po wklejeniu danych.
								</div>
							) : (
								<table className="w-full text-left text-sm">
									<thead className="sticky top-0 bg-slate-200 text-slate-600 shadow-sm">
										<tr>
											<th className="p-3 font-bold">Status</th>
											<th className="p-3 font-bold">Imię i Nazwisko</th>
											<th className="p-3 font-bold">Data (do bazy)</th>
										</tr>
									</thead>
									<tbody>
										{previewRows.map((row) => (
											<tr key={row.id} className="border-b border-slate-100 bg-white hover:bg-slate-50">
												<td className="p-3">
													{row.isValid ? (
														<CheckCircleFill className="text-green-500" title="OK" />
													) : (
														<ExclamationCircleFill className="text-red-500" title="Błąd" />
													)}
												</td>
												<td className="p-3">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-slate-800">{row.firstName}</span>
														<span className="text-slate-600">{row.lastName}</span>
														<button
															onClick={() => swapNames(row.id)}
															className="cursor-pointer rounded border border-slate-200 bg-slate-100 p-1 text-xs text-slate-500 transition-colors hover:text-blue-600"
															title="Zamień"
														>
															<ArrowLeftRight />
														</button>
													</div>
												</td>
												<td className="p-3">
													{row.isValid ? (
														<span className="font-mono text-green-700">{row.parsedDate}</span>
													) : (
														<div className="text-xs text-red-500">"{row.rawDate}"</div>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>

						<div className="mt-6 flex justify-end">
							<button
								onClick={handleSubmit}
								disabled={isSaving || previewRows.length === 0 || previewRows.some((r) => !r.isValid)}
								className="cursor-pointer rounded-lg bg-green-600 px-8 py-3 font-bold text-white shadow-md transition-all hover:bg-green-700 disabled:bg-slate-400"
							>
								{isSaving ? 'Zapisywanie...' : `Importuj ${previewRows.filter((r) => r.isValid).length} uczniów`}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
