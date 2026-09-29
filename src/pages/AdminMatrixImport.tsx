import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService, type Group } from '../api/groupService';
import { importService, type ImportMatrixRequest, type MatchedStudentDto } from '../api/importService';
import axios from 'axios';
import {
	ClipboardData,
	CheckCircleFill,
	ExclamationTriangleFill,
	PersonXFill,
	FileEarmarkXFill,
	PeopleFill,
	PersonFill,
	CheckSquareFill,
	Square,
} from 'react-bootstrap-icons';
import toast from 'react-hot-toast';

type TargetMode = 'group' | 'students';

export function AdminMatrixImport() {
	const navigate = useNavigate();
	const [groups, setGroups] = useState<Group[]>([]);
	const [selectedGroupId, setSelectedGroupId] = useState<string>('');
	const [rawPastedText, setRawPastedText] = useState('');

	const [targetMode, setTargetMode] = useState<TargetMode>('students');
	const [parsedData, setParsedData] = useState<ImportMatrixRequest | null>(null);
	const [matchedStudents, setMatchedStudents] = useState<MatchedStudentDto[]>([]);
	const [selectedStudentNames, setSelectedStudentNames] = useState<Set<string>>(new Set());

	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);

	const [missingStudents, setMissingStudents] = useState<string[]>([]);
	const [missingProjects, setMissingProjects] = useState<string[]>([]);

	useEffect(() => {
		let isMounted = true;

		const fetchGroups = async () => {
			try {
				const data = await groupService.getAll();
				if (isMounted) {
					setGroups(data);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error('Nie udało się pobrać listy grup.');
				}
			}
		};

		fetchGroups();

		return () => {
			isMounted = false;
		};
	}, []);

	const handleParse = async () => {
		if (!rawPastedText.trim()) {
			toast.error('Wklej najpierw dane z Excela!');
			return;
		}

		setIsParsing(true);
		setMissingStudents([]);
		setMissingProjects([]);
		setParsedData(null);
		setMatchedStudents([]);
		setSelectedStudentNames(new Set());

		try {
			const rows = rawPastedText.split('\n').map((r) => r.split('\t'));
			const headerRowIndex = rows.findIndex((r) => r.some((cell) => cell.toLowerCase().includes('projekty')));

			if (headerRowIndex === -1) {
				toast.error('Nie znaleziono nagłówka. Skopiuj tabelę z wierszem zawierającym słowo "Projekty".');
				return;
			}

			const headerRow = rows[headerRowIndex];
			const startIndex = 3;
			const endIndex = headerRow.findIndex((cell) => cell.toLowerCase().includes('status dziecka'));
			const rawStudentNames = endIndex !== -1 ? headerRow.slice(startIndex, endIndex) : headerRow.slice(startIndex);

			const cleanStudentNames = rawStudentNames
				.map((name) =>
					name
						.replace(
							/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g,
							'',
						)
						.trim(),
				)
				.filter((name) => name.length > 0);

			if (cleanStudentNames.length === 0) {
				toast.error('Nie znaleziono żadnych imion uczniów w nagłówku tabeli!');
				return;
			}

			const projectRowsRaw = rows.filter((r, idx) => idx > headerRowIndex && r[0] && !isNaN(parseInt(r[0].trim())));

			const parsedRows = projectRowsRaw.map((r) => {
				return {
					projectName: r[1]?.trim() || 'Brak nazwy',
					projectCode: r[2]?.trim() || '',
					statuses: r.slice(startIndex, startIndex + cleanStudentNames.length).map((s) => s.trim()),
				};
			});

			const matrixData: ImportMatrixRequest = {
				studentNames: cleanStudentNames,
				rows: parsedRows,
			};

			setParsedData(matrixData);

			// Wyszukujemy uczniów w bazie danych
			try {
				const matched = await importService.matchStudents(cleanStudentNames);
				setMatchedStudents(matched);

				// Domyślnie zaznaczamy wszystkich znalezionych w bazie
				const initialSelected = new Set(
					matched.filter((m) => m.isMatched).map((m) => m.nameInExcel)
				);
				setSelectedStudentNames(initialSelected);
			} catch (err) {
				console.error('Błąd dopasowywania uczniów:', err);
				// Jeśli zapytanie o dopasowanie się nie powiedzie, zaznaczamy wszystkich z tabeli
				setSelectedStudentNames(new Set(cleanStudentNames));
			}

			toast.success(`Przeanalizowano ${parsedRows.length} projektów i ${cleanStudentNames.length} uczniów!`);
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas parsowania. Sprawdź czy tabela została poprawnie skopiowana z Excela.');
		} finally {
			setIsParsing(false);
		}
	};

	const toggleStudentSelection = (name: string) => {
		setSelectedStudentNames((prev) => {
			const next = new Set(prev);
			if (next.has(name)) {
				next.delete(name);
			} else {
				next.add(name);
			}
			return next;
		});
	};

	const selectAllMatched = () => {
		if (matchedStudents.length > 0) {
			const matched = matchedStudents.filter((m) => m.isMatched).map((m) => m.nameInExcel);
			setSelectedStudentNames(new Set(matched));
		} else if (parsedData) {
			setSelectedStudentNames(new Set(parsedData.studentNames));
		}
	};

	const deselectAll = () => {
		setSelectedStudentNames(new Set());
	};

	const handleImport = async () => {
		if (!parsedData) return;

		if (targetMode === 'group' && !selectedGroupId) {
			toast.error('Wybierz grupę docelową!');
			return;
		}

		if (selectedStudentNames.size === 0) {
			toast.error('Zaznacz co najmniej jednego ucznia do migracji!');
			return;
		}

		setIsImporting(true);
		setMissingStudents([]);
		setMissingProjects([]);

		try {
			const payload: ImportMatrixRequest = {
				groupId: targetMode === 'group' ? selectedGroupId : null,
				studentNames: parsedData.studentNames,
				rows: parsedData.rows,
				selectedStudentNames: Array.from(selectedStudentNames),
			};

			const response = await importService.importProjectsMatrix(payload);
			toast.success(response.message || '🎉 Pomyślnie zmigrowano dane!');
			setParsedData(null);
			setMatchedStudents([]);
			setSelectedStudentNames(new Set());
			setRawPastedText('');
		} catch (error: unknown) {
			if (
				axios.isAxiosError(error) &&
				error.response?.status === 400 &&
				(error.response.data.missingStudents || error.response.data.missingProjects)
			) {
				setMissingStudents(error.response.data.missingStudents || []);
				setMissingProjects(error.response.data.missingProjects || []);
				toast.error('Zatrzymano: Brakuje danych w bazie głównej!');
			} else if (axios.isAxiosError(error) && error.response?.data?.message) {
				const detail = error.response.data.detail ? `: ${error.response.data.detail}` : '';
				toast.error(`${error.response.data.message}${detail}`);
			} else {
				toast.error('Wystąpił nieoczekiwany błąd serwera.');
				console.error(error);
			}
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold text-slate-800">Jednorazowa Migracja Matrycy</h1>
				<p className="mt-1 text-slate-500">
					Wklej tabelę ze starego arkusza Excel, a następnie wybierz czy migrujesz całą grupę, czy wyselekcjonowane pojedyncze osoby.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
				{/* LEWA KOLUMNA: Wklejanie */}
				<div className="flex flex-col gap-4">
					<div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<label className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700">
							<span>1. Wklej komórki z Excela</span>
							{rawPastedText && (
								<button
									onClick={() => setRawPastedText('')}
									className="text-xs font-semibold text-slate-400 hover:text-red-500"
								>
									Wyczyść
								</button>
							)}
						</label>
						<textarea
							value={rawPastedText}
							onChange={(e) => setRawPastedText(e.target.value)}
							placeholder="Zaznacz całą tabelę w Excelu łącznie z nagłówkami (wiersz z napisem 'Projekty') i wklej (Ctrl+V) tutaj..."
							className="min-h-85 w-full flex-1 overflow-x-auto rounded-lg border border-slate-300 p-4 font-mono text-xs whitespace-pre transition-all outline-none focus:border-blue-500"
						></textarea>
						<button
							onClick={handleParse}
							disabled={isParsing || !rawPastedText.trim()}
							className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-800 p-3.5 font-bold text-white shadow transition-all hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
						>
							<ClipboardData size={18} /> {isParsing ? 'Analizowanie...' : 'Przeanalizuj tabelę'}
						</button>
					</div>
				</div>

				{/* PRAWA KOLUMNA: Cel migracji i podgląd */}
				<div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-4 text-xl font-bold text-slate-800">2. Cel migracji i Wybór</h2>

					{!parsedData ? (
						<div className="flex h-85 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
							<ClipboardData size={48} className="mb-4 opacity-30" />
							<p className="font-medium">Oczekuję na wklejenie i kliknięcie „Przeanalizuj tabelę”...</p>
							<p className="mt-1 text-xs text-slate-400">Po analizie wybierzesz grupę docelową lub poszczególnych uczniów.</p>
						</div>
					) : (
						<div className="animate-in fade-in flex flex-col gap-5 duration-300">
							{/* PRZEŁĄCZNIK TRYBU */}
							<div>
								<label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
									Gdzie zapisać statusy?
								</label>
								<div className="grid grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() => setTargetMode('students')}
										className={`flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 p-3 text-sm font-bold transition-all ${
											targetMode === 'students'
												? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
												: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
										}`}
									>
										<PersonFill size={18} />
										<span>Do uczniów (wybór)</span>
									</button>

									<button
										type="button"
										onClick={() => setTargetMode('group')}
										className={`flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 p-3 text-sm font-bold transition-all ${
											targetMode === 'group'
												? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
												: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
										}`}
									>
										<PeopleFill size={18} />
										<span>Do konkretnej grupy</span>
									</button>
								</div>
							</div>

							{/* OPCJA A: Wybór konkretnej grupy */}
							{targetMode === 'group' && (
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<label className="mb-1.5 block text-xs font-bold text-slate-700">Wybierz grupę docelową z bazy:</label>
									<select
										value={selectedGroupId}
										onChange={(e) => setSelectedGroupId(e.target.value)}
										className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-medium transition-all outline-none focus:border-blue-500"
									>
										<option value="">-- Wybierz grupę --</option>
										{groups.map((g) => (
											<option key={g.id} value={g.id}>
												{g.name} ({g.branchName})
											</option>
										))}
									</select>
									<p className="mt-2 text-xs text-slate-500">
										Statusy zostaną przypisane do uczniów należących do wybranej grupy.
									</p>
								</div>
							)}

							{/* SEKCJA WYBORU UCZNIÓW (Dla obu trybów, z naciskiem na 'students') */}
							<div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
								<div className="mb-3 flex items-center justify-between">
									<span className="text-xs font-bold text-slate-700">
										Wykryci uczniowie ({selectedStudentNames.size} z {parsedData.studentNames.length} zaznaczonych):
									</span>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={selectAllMatched}
											className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline"
										>
											Zaznacz pasujących
										</button>
										<span className="text-slate-300">|</span>
										<button
											type="button"
											onClick={deselectAll}
											className="cursor-pointer text-xs font-semibold text-slate-500 hover:underline"
										>
											Odznacz
										</button>
									</div>
								</div>

								<div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 divide-y divide-slate-100">
									{parsedData.studentNames.map((name) => {
										const matched = matchedStudents.find((m) => m.nameInExcel === name);
										const isSelected = selectedStudentNames.has(name);
										const isFound = matched?.isMatched;

										return (
											<div
												key={name}
												onClick={() => toggleStudentSelection(name)}
												className={`flex cursor-pointer items-center justify-between gap-3 p-2 text-xs transition-colors rounded-md ${
													isSelected ? 'bg-blue-50/80 font-semibold text-blue-900' : 'hover:bg-slate-50 text-slate-700'
												}`}
											>
												<div className="flex items-center gap-2.5 truncate">
													{isSelected ? (
														<CheckSquareFill className="text-blue-600 shrink-0" size={16} />
													) : (
														<Square className="text-slate-400 shrink-0" size={16} />
													)}
													<span className="truncate">{name}</span>
												</div>

												{isFound ? (
													<span className="shrink-0 flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 border border-green-200">
														<CheckCircleFill size={10} />
														<span>
															{matched.groupName ? matched.groupName : 'Bez grupy'}
															{matched.branchName ? ` (${matched.branchName})` : ''}
														</span>
													</span>
												) : (
													<span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
														Brak w bazie
													</span>
												)}
											</div>
										);
									})}
								</div>
								{targetMode === 'students' && (
									<p className="mt-2 text-[11px] text-slate-500">
										💡 Możesz odznaczyć wszystkich i zaznaczyć tylko <strong>1 wybraną osobę</strong>. Osoby niezaznaczone zostaną całkowicie pominięte.
									</p>
								)}
							</div>

							{/* BŁĘDY / BRAKI W BAZIE */}
							{(missingStudents.length > 0 || missingProjects.length > 0) && (
								<div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
									<div className="mb-2 flex items-center gap-2 text-red-700">
										<ExclamationTriangleFill size={20} className="shrink-0" />
										<h3 className="font-extrabold text-sm">Zatrzymano: Braki w bazie danych!</h3>
									</div>

									{missingStudents.length > 0 && (
										<div className="mb-3">
											<h4 className="mb-1 flex items-center gap-1 text-xs font-bold text-red-800">
												<PersonXFill /> Brakujący Uczniowie (odznacz ich lub dodaj do bazy):
											</h4>
											<div className="flex flex-wrap gap-1.5">
												{missingStudents.map((s, i) => (
													<span key={i} className="rounded bg-white px-2 py-0.5 text-xs font-bold text-red-700 shadow-sm">
														{s}
													</span>
												))}
											</div>
										</div>
									)}

									{missingProjects.length > 0 && (
										<div>
											<h4 className="mb-1 flex items-center gap-1 text-xs font-bold text-red-800">
												<FileEarmarkXFill /> Brakujące Projekty w systemie:
											</h4>
											<div className="flex flex-wrap gap-1.5">
												{missingProjects.map((p, i) => (
													<span key={i} className="rounded bg-white px-2 py-0.5 text-xs font-bold text-red-700 shadow-sm">
														{p}
													</span>
												))}
											</div>
										</div>
									)}

									<div className="mt-3 flex gap-2 border-t border-red-200 pt-3">
										{missingStudents.length > 0 && (
											<button
												type="button"
												onClick={() => navigate('/uczniowie')}
												className="cursor-pointer rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-200"
											>
												Baza Uczniów
											</button>
										)}
										{missingProjects.length > 0 && (
											<button
												type="button"
												onClick={() => navigate('/admin/projekty')}
												className="cursor-pointer rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-200"
											>
												Baza Projektów
											</button>
										)}
									</div>
								</div>
							)}

							{/* STATUS GOTOWOŚCI */}
							{missingStudents.length === 0 && missingProjects.length === 0 && (
								<div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-emerald-800">
									<CheckCircleFill size={24} className="shrink-0 text-emerald-600" />
									<div className="text-xs">
										<p className="font-bold text-sm">
											Gotowe do migracji: {selectedStudentNames.size} uczniów, {parsedData.rows.length} projektów
										</p>
										<p className="mt-0.5 text-emerald-700">
											{targetMode === 'group'
												? 'Zapis do wybranej grupy.'
												: 'Zapis bezpośrednio do wybranych uczniów w ich aktualnych grupach.'}
										</p>
									</div>
								</div>
							)}

							{/* PRZYCISK ZATWIERDZENIA */}
							<button
								onClick={handleImport}
								disabled={isImporting || selectedStudentNames.size === 0 || (targetMode === 'group' && !selectedGroupId)}
								className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 p-4 text-base font-bold text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
							>
								{isImporting
									? 'Migrowanie danych...'
									: `Zatwierdź i Wykonaj Migrację (${selectedStudentNames.size} os.)`}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
