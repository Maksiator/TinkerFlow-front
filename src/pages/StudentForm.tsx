import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'react-bootstrap-icons';
import { studentService, type StudentRequest, SkillLevel } from '../api/studentService';
import { groupService, type Group } from '../api/groupService';
import { branchService, type Branch } from '../api/branchService';
import { systemSettingsService } from '../api/systemSettingsService';
import toast from 'react-hot-toast';

export function StudentForm() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const isEditMode = Boolean(id) && id !== 'nowy';

	const [formData, setFormData] = useState<StudentRequest>({
		firstName: '',
		lastName: '',
		dateOfBirth: '',
		level: SkillLevel.Beginner,
		isIndependent: false,
		needsAttention: false,
		groupId: null,
		branchId: null,
	});

	const [initialGroupId, setInitialGroupId] = useState<string | null>(null);

	const [groups, setGroups] = useState<Group[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	// Wyszukiwarka dla głównej grupy
	const [mainGroupSearch, setMainGroupSearch] = useState('');
	const [isMainGroupDropdownOpen, setIsMainGroupDropdownOpen] = useState(false);
	const mainGroupDropdownRef = useRef<HTMLDivElement>(null);

	// Historia ucznia
	const [history, setHistory] = useState<import('../api/studentService').StudentHistoryResponse | null>(null);
	const [newHistoryGroup, setNewHistoryGroup] = useState('');
	const [newHistoryYear, setNewHistoryYear] = useState('');

	// Wyszukiwarka dla historii grup
	const [historyGroupSearch, setHistoryGroupSearch] = useState('');
	const [isHistoryGroupDropdownOpen, setIsHistoryGroupDropdownOpen] = useState(false);
	const historyGroupDropdownRef = useRef<HTMLDivElement>(null);

	// Modal i ustawienia
	const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
	const [removeReason, setRemoveReason] = useState<'midyear' | 'mistake'>('midyear');
	const [systemAcademicYear, setSystemAcademicYear] = useState('2024/2025');

	// ZAKTUALIZOWANY USEEFFECT: Wzorzec isMounted + poprawne mapowanie danych
	useEffect(() => {
		let isMounted = true;

		const fetchData = async () => {
			setIsLoading(true);
			try {
				// Pobieramy grupy i oddziały
				const [fetchedGroups, fetchedBranches] = await Promise.all([
					groupService.getAll(),
					branchService.getAll()
				]);

				if (isMounted) {
					setGroups(fetchedGroups);
					setBranches(fetchedBranches);
				}

				if (isEditMode && id) {
					const [student, historyData, sysSettings] = await Promise.all([
						studentService.getById(id),
						studentService.getHistory(id),
						systemSettingsService.getSettings().catch(() => null)
					]);

					if (isMounted) {
						setSystemAcademicYear(sysSettings?.currentAcademicYear || '2024/2025');
						setInitialGroupId(student.groupId);
						setFormData({
							firstName: student.firstName,
							lastName: student.lastName,
							dateOfBirth: student.dateOfBirth,
							level: student.level,
							isIndependent: student.isIndependent,
							needsAttention: student.needsAttention,
							groupId: student.groupId,
							branchId: student.branchId || null,
						});
						setHistory(historyData);
					}
				}
			} catch (error) {
				console.error(error); // ESLint zadowolony
				if (isMounted) {
					toast.error('Błąd pobierania danych.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchData();

		return () => {
			isMounted = false;
		};
	}, [id, isEditMode]);

	const handlePreSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Jeśli jesteśmy w trybie edycji, uczeń miał grupę, i właśnie ją zmieniliśmy (lub usunęliśmy)
		if (isEditMode && initialGroupId && formData.groupId !== initialGroupId) {
			setIsSubmitModalOpen(true);
		} else {
			handleSubmitFinal();
		}
	};

	const handleSubmitFinal = async () => {
		setIsSaving(true);
		setIsSubmitModalOpen(false);
		try {
			const payload: StudentRequest = {
				...formData,
				groupId: formData.groupId === '' ? null : formData.groupId,
				branchId: formData.groupId ? null : formData.branchId,
			};

			if (isEditMode && initialGroupId && formData.groupId !== initialGroupId) {
				payload.recordHistory = removeReason === 'midyear';
				payload.isMidYear = removeReason === 'midyear';
				payload.academicYear = removeReason === 'midyear' ? systemAcademicYear : undefined;
			}

			if (isEditMode && id) {
				await studentService.update(id, payload);
				toast.success('Dane zaktualizowane!');
			} else {
				await studentService.create(payload);
				toast.success('Uczeń dodany do bazy!');
			}
			navigate('/uczniowie');
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się zapisać ucznia.');
		} finally {
			setIsSaving(false);
		}
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (mainGroupDropdownRef.current && !mainGroupDropdownRef.current.contains(event.target as Node)) {
				setIsMainGroupDropdownOpen(false);
			}
			if (historyGroupDropdownRef.current && !historyGroupDropdownRef.current.contains(event.target as Node)) {
				setIsHistoryGroupDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleAddHistory = async () => {
		if (!id || !newHistoryGroup || !newHistoryYear) return;
		try {
			await studentService.addGroupHistory(id, newHistoryGroup, newHistoryYear);
			toast.success('Dodano wpis do historii.');
			setNewHistoryGroup('');
			setNewHistoryYear('');
			const historyData = await studentService.getHistory(id);
			setHistory(historyData);
		} catch (error) {
			console.error(error);
			toast.error('Błąd przy dodawaniu historii.');
		}
	};

	const handleDeleteHistory = async (historyId: string) => {
		if (!id) return;
		if (!window.confirm('Na pewno usunąć ten wpis z historii?')) return;
		try {
			await studentService.deleteGroupHistory(id, historyId);
			toast.success('Wpis usunięty.');
			const historyData = await studentService.getHistory(id);
			setHistory(historyData);
		} catch (error) {
			console.error(error);
			toast.error('Błąd przy usuwaniu.');
		}
	};

	const handleProjectStatusChange = async (projectId: string, newStatus: number) => {
		if (!id) return;
		try {
			// Import it at the top or use dynamic import/window fetch
			// Actually we need to import studentProjectService
			const { studentProjectService } = await import('../api/studentProjectService');
			
			// status 0 = NotStarted (usunięcie)
			await studentProjectService.upsert(id, projectId, newStatus as any);
			toast.success('Zaktualizowano status projektu.');
			
			// Odśwież dane
			const historyData = await studentService.getHistory(id);
			setHistory(historyData);
		} catch (error) {
			console.error(error);
			toast.error('Błąd aktualizacji projektu.');
		}
	};

	const getStatusStyle = (status: number) => {
		switch (status) {
			case 1:
				return 'bg-blue-50 border-blue-300 text-blue-700 font-bold';
			case 2:
				return 'bg-yellow-100 border-yellow-400 text-yellow-800 font-bold';
			case 3:
				return 'bg-purple-100 border-purple-400 text-purple-700 font-bold';
			case 5:
				return 'bg-indigo-100 border-indigo-400 text-indigo-700 font-bold';
			case 4:
				return 'bg-green-100 border-green-500 text-green-700 font-bold shadow-inner';
			case 0:
			default:
				return 'bg-white border-slate-200 text-slate-400 font-normal hover:bg-slate-50 hover:border-slate-300';
		}
	};

	if (isLoading) return <div className="p-10 text-center font-bold text-slate-400">Ładowanie...</div>;

	return (
		<div className="mx-auto max-w-3xl p-4 md:p-8">
			<button
				onClick={() => navigate('/uczniowie')}
				className="mb-6 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-600"
			>
				<ArrowLeft /> Powrót do listy
			</button>

			<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
				<h1 className="mb-8 text-2xl font-bold text-slate-800">{isEditMode ? 'Edytuj dane ucznia' : 'Dodaj ucznia'}</h1>

				<form onSubmit={handlePreSubmit} className="flex flex-col gap-6">
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-bold text-slate-700">Imię</label>
							<input
								type="text"
								required
								value={formData.firstName}
								onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
								className="w-full rounded-lg border border-slate-300 p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label className="mb-2 block text-sm font-bold text-slate-700">Nazwisko</label>
							<input
								type="text"
								required
								value={formData.lastName}
								onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
								className="w-full rounded-lg border border-slate-300 p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-bold text-slate-700">Data urodzenia</label>
							<input
								type="date"
								required
								max={new Date().toISOString().split('T')[0]}
								value={formData.dateOfBirth}
								onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
								className="w-full rounded-lg border border-slate-300 p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							/>
						</div>
						<div className="md:col-span-2 relative" ref={mainGroupDropdownRef}>
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Grupa</label>
							<div className="relative">
								<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
								<input
									type="text"
									placeholder="Wyszukaj grupę..."
									value={mainGroupSearch || (formData.groupId ? `${groups.find(g => g.id === formData.groupId)?.name || ''} (${groups.find(g => g.id === formData.groupId)?.branchName || ''})` : '')}
									onChange={(e) => {
										setMainGroupSearch(e.target.value);
										if (e.target.value === '') setFormData({ ...formData, groupId: null });
										setIsMainGroupDropdownOpen(true);
									}}
									onFocus={() => {
										setIsMainGroupDropdownOpen(true);
										setMainGroupSearch('');
									}}
									className="w-full rounded-lg border border-slate-300 py-3 pr-4 pl-10 text-sm outline-none focus:border-blue-500"
								/>
							</div>
							
							{isMainGroupDropdownOpen && (
								<div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
									<div 
										className="cursor-pointer border-b border-slate-100 p-3 text-sm hover:bg-slate-50 text-slate-500 italic"
										onClick={() => {
											setFormData({ ...formData, groupId: null });
											setMainGroupSearch('');
											setIsMainGroupDropdownOpen(false);
										}}
									>
										Brak grupy
									</div>
									{groups.filter(g => (g.name + ' ' + g.branchName).toLowerCase().includes(mainGroupSearch.toLowerCase())).length === 0 ? (
										<div className="p-3 text-sm text-slate-500">Brak wyników</div>
									) : (
										groups.filter(g => (g.name + ' ' + g.branchName).toLowerCase().includes(mainGroupSearch.toLowerCase())).map(g => (
											<div
												key={g.id}
												onClick={() => {
													setFormData({ ...formData, groupId: g.id });
													setMainGroupSearch(''); // zresetuj, wyświetlać będziemy z formData
													setIsMainGroupDropdownOpen(false);
												}}
												className="cursor-pointer border-b border-slate-100 p-3 text-sm hover:bg-slate-50 last:border-0"
											>
												<span className="font-bold">{g.name}</span> <span className="text-slate-500">({g.branchName})</span>
											</div>
										))
									)}
								</div>
							)}
						</div>

						{!formData.groupId && (
							<div className="md:col-span-2">
								<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Oddział (Wymagany przy braku grupy)</label>
								<select
									value={formData.branchId || ''}
									onChange={(e) => setFormData({ ...formData, branchId: e.target.value || null })}
									required
									className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500"
								>
									<option value="">Wybierz oddział...</option>
									{branches.map((b) => (
										<option key={b.id} value={b.id}>
											{b.name}
										</option>
									))}
								</select>
							</div>
						)}
					</div>

					<div>
						<label className="mb-2 block text-sm font-bold text-slate-700">Poziom</label>
						<select
							value={formData.level}
							onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) as SkillLevel })}
							className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						>
							<option value={SkillLevel.Beginner}>Początkujący</option>
							<option value={SkillLevel.Intermediate}>Średniozaawansowany</option>
							<option value={SkillLevel.Advanced}>Zaawansowany</option>
						</select>
					</div>

					<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
						<div className="flex flex-col gap-3">
							<label className="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									checked={formData.isIndependent}
									onChange={(e) => setFormData({ ...formData, isIndependent: e.target.checked })}
									className="h-5 w-5 rounded border-slate-300"
								/>
								<span className="text-sm font-medium text-slate-700">Pracuje samodzielnie (Zdolniacha)</span>
							</label>
							<label className="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									checked={formData.needsAttention}
									onChange={(e) => setFormData({ ...formData, needsAttention: e.target.checked })}
									className="h-5 w-5 rounded border-slate-300"
								/>
								<span className="text-sm font-medium text-slate-700">Wymaga większej uwagi</span>
							</label>
						</div>
					</div>

					<div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-6">
						<button
							type="button"
							onClick={() => navigate('/uczniowie')}
							className="cursor-pointer rounded-lg bg-slate-100 px-6 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-200"
						>
							Anuluj
						</button>
						<button
							type="submit"
							disabled={isSaving}
							className="cursor-pointer rounded-lg bg-blue-600 px-8 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
						>
							{isSaving ? 'Zapisywanie...' : 'Zapisz'}
						</button>
					</div>
				</form>
			</div>

			{/* SEKCJA HISTORII I PROJEKTÓW (TYLKO TRYB EDYCJI) */}
			{isEditMode && history && (
				<div className="mt-8 flex flex-col gap-8">
					{/* PROJEKTY (MINI-MATRIX) */}
					<div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
						<h2 className="mb-6 text-xl font-bold text-slate-800">Projekty Ucznia</h2>
						
						<h3 className="mb-3 text-sm font-bold text-slate-500 uppercase">Aktywne</h3>
						{history.activeProjects.length === 0 ? (
							<p className="mb-6 text-sm text-slate-500">Brak aktywnych projektów.</p>
						) : (
							<div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
								<ul className="divide-y divide-slate-200">
									{history.activeProjects.map(p => (
										<li key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-4">
											<span className="mb-2 sm:mb-0 font-bold text-slate-800">{p.projectName}</span>
											<select
												value={p.status}
												onChange={e => handleProjectStatusChange(p.projectId, Number(e.target.value))}
												className={`rounded-lg border px-3 py-1.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-48 ${getStatusStyle(p.status)}`}
											>
												<option value={0} className="bg-white text-slate-700 font-normal">Brak (Usuń przypisanie)</option>
												<option value={1} className="bg-white text-slate-700 font-normal">Zaplanowane</option>
												<option value={2} className="bg-white text-slate-700 font-normal">W trakcie</option>
												<option value={3} className="bg-white text-slate-700 font-normal">Gotowe do druku</option>
												<option value={4} className="bg-white text-slate-700 font-normal">Zrealizowane</option>
												<option value={5} className="bg-white text-slate-700 font-normal" disabled>Wysłane do druku</option>
											</select>
										</li>
									))}
								</ul>
							</div>
						)}
					</div>

					{/* HISTORIA GRUP */}
					<div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
						<h2 className="mb-6 text-xl font-bold text-slate-800">Historia Grup</h2>
						
						<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
							<div className="flex-1">
								<label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Rok szkolny</label>
								<input
									type="text"
									placeholder="np. 2025/2026"
									value={newHistoryYear}
									onChange={e => setNewHistoryYear(e.target.value)}
									className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-blue-500"
								/>
							</div>
							<div className="flex-1 relative" ref={historyGroupDropdownRef}>
								<label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Grupa</label>
								<div className="relative">
									<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
									<input
										type="text"
										placeholder="Wyszukaj grupę..."
										value={historyGroupSearch || (newHistoryGroup ? `${groups.find(g => g.id === newHistoryGroup)?.name || ''} (${groups.find(g => g.id === newHistoryGroup)?.branchName || ''})` : '')}
										onChange={(e) => {
											setHistoryGroupSearch(e.target.value);
											if (e.target.value === '') setNewHistoryGroup('');
											setIsHistoryGroupDropdownOpen(true);
										}}
										onFocus={() => {
											setIsHistoryGroupDropdownOpen(true);
											setHistoryGroupSearch('');
										}}
										className="w-full rounded-lg border border-slate-300 py-2.5 pr-4 pl-10 text-sm outline-none focus:border-blue-500"
									/>
								</div>

								{isHistoryGroupDropdownOpen && (
									<div className="absolute bottom-full mb-1 z-20 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
										{groups.filter(g => (g.name + ' ' + g.branchName).toLowerCase().includes(historyGroupSearch.toLowerCase())).length === 0 ? (
											<div className="p-3 text-sm text-slate-500">Brak wyników</div>
										) : (
											groups.filter(g => (g.name + ' ' + g.branchName).toLowerCase().includes(historyGroupSearch.toLowerCase())).map(g => (
												<div
													key={g.id}
													onClick={() => {
														setNewHistoryGroup(g.id);
														setHistoryGroupSearch('');
														setIsHistoryGroupDropdownOpen(false);
													}}
													className="cursor-pointer border-b border-slate-100 p-3 text-sm hover:bg-slate-50 last:border-0"
												>
													<span className="font-bold">{g.name}</span> <span className="text-slate-500">({g.branchName})</span>
												</div>
											))
										)}
									</div>
								)}
							</div>
							<button
								type="button"
								onClick={handleAddHistory}
								disabled={!newHistoryGroup || !newHistoryYear}
								className="rounded-lg bg-green-600 px-6 py-2.5 font-bold text-white transition-colors hover:bg-green-700 disabled:bg-slate-300"
							>
								Dodaj
							</button>
						</div>

						{history.groupHistory.length === 0 ? (
							<p className="text-sm text-slate-500">Brak historii przypisań do grup.</p>
						) : (
							<div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
								<ul className="divide-y divide-slate-200">
									{history.groupHistory.map(h => (
										<li key={h.id} className="flex items-center justify-between px-5 py-4">
											<div>
												<span className="font-bold text-blue-700">{h.academicYear}</span>
												<span className="mx-3 font-medium text-slate-300">|</span>
												<span className="font-bold text-slate-700">{h.groupName}</span>
											</div>
											<button
												onClick={() => handleDeleteHistory(h.id)}
												className="cursor-pointer rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-200 hover:text-red-700"
											>
												Usuń
											</button>
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				</div>
			)}

			{/* MODAL ZMIANY/USUNIĘCIA GRUPY */}
			{isSubmitModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<h3 className="mb-2 text-xl font-bold text-slate-800">Zmiana / Wypisanie z grupy</h3>
						<p className="mb-6 text-sm text-slate-500">
							Określ powód usunięcia ucznia <strong>{formData.firstName} {formData.lastName}</strong> z dotychczasowej grupy.
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
										Zapis o uczestnictwie w starej grupie trafi do Historii Grupy. Użyjemy roku: <strong>{systemAcademicYear}</strong>.
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
										Uczeń zostanie wykreślony ze starej listy bez pozostawiania śladu w historii.
									</div>
								</div>
							</label>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setIsSubmitModalOpen(false)}
								disabled={isSaving}
								className="flex-1 rounded-xl border border-slate-300 bg-white py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
							>
								Anuluj
							</button>
							<button
								onClick={handleSubmitFinal}
								disabled={isSaving}
								className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700"
							>
								{isSaving ? 'Zapisywanie...' : 'Potwierdź'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
