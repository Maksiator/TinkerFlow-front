import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService, type Group } from '../api/groupService';
import { importService, type ImportMatrixRequest } from '../api/importService';
import axios from 'axios';
import {
	ClipboardData,
	CheckCircleFill,
	ExclamationTriangleFill,
	PersonXFill,
	FileEarmarkXFill,
} from 'react-bootstrap-icons';
import toast from 'react-hot-toast';

export function AdminMatrixImport() {
	const navigate = useNavigate();
	const [groups, setGroups] = useState<Group[]>([]);
	const [selectedGroupId, setSelectedGroupId] = useState<string>('');
	const [rawPastedText, setRawPastedText] = useState('');

	const [parsedData, setParsedData] = useState<ImportMatrixRequest | null>(null);
	const [isParsing, setIsParsing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);

	const [missingStudents, setMissingStudents] = useState<string[]>([]);
	const [missingProjects, setMissingProjects] = useState<string[]>([]);

	// ZAKTUALIZOWANY USEEFFECT: Wzorzec isMounted i obsługa błędów
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

	const handleParse = () => {
		if (!selectedGroupId) {
			toast.error('Najpierw wybierz grupę docelową!');
			return;
		}
		if (!rawPastedText.trim()) {
			toast.error('Wklej najpierw dane z Excela!');
			return;
		}

		setIsParsing(true);
		setMissingStudents([]);
		setMissingProjects([]);

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
				toast.error('Nie znalazłem żadnych imion uczniów w nagłówku!');
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

			setParsedData({
				groupId: selectedGroupId,
				studentNames: cleanStudentNames,
				rows: parsedRows,
			});

			toast.success('Przeanalizowano bezbłędnie! Kliknij Importuj.');
		} catch (error) {
			console.error(error);
			toast.error('Krytyczny błąd podczas parsowania. Sprawdź format tabeli.');
		} finally {
			setIsParsing(false);
		}
	};

	const handleImport = async () => {
		if (!parsedData) return;
		setIsImporting(true);
		setMissingStudents([]);
		setMissingProjects([]);

		try {
			await importService.importProjectsMatrix(parsedData);
			toast.success('🎉 Pomyślnie zmigrowano dane grupy!');
			setParsedData(null);
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
			} else {
				toast.error('Wystąpił nieoczekiwany błąd serwera.');
				console.error(error);
			}
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold text-slate-800">Jednorazowa Migracja Matrycy</h1>
				<p className="text-slate-500">Przenieś historię statusów grupy ze starego arkusza Excel.</p>
			</div>

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<label className="mb-2 block text-sm font-bold text-slate-700">1. Wybierz grupę docelową</label>
						<select
							value={selectedGroupId}
							onChange={(e) => setSelectedGroupId(e.target.value)}
							className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 transition-all outline-none focus:border-blue-500"
						>
							<option value="">-- Wybierz grupę --</option>
							{groups.map((g) => (
								<option key={g.id} value={g.id}>
									{/* ZMIANA: Z g.location na g.branchName */}
									{g.name} ({g.branchName})
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<label className="mb-2 block text-sm font-bold text-slate-700">2. Wklej komórki z Excela</label>
						<textarea
							value={rawPastedText}
							onChange={(e) => setRawPastedText(e.target.value)}
							placeholder="Zaznacz tabelę w Excelu łącznie z nagłówkami i wklej (Ctrl+V) tutaj..."
							className="min-h-75 w-full flex-1 overflow-x-auto rounded-lg border border-slate-300 p-4 font-mono text-xs whitespace-pre transition-all outline-none focus:border-blue-500"
						></textarea>
						<button
							onClick={handleParse}
							disabled={isParsing || !rawPastedText}
							className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-800 p-3 font-bold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
						>
							<ClipboardData /> Przeanalizuj tabelę
						</button>
					</div>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-4 text-xl font-bold text-slate-800">Podgląd i Weryfikacja</h2>

					{!parsedData ? (
						<div className="flex h-75 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
							<ClipboardData size={48} className="mb-4 opacity-30" />
							<p className="font-medium">Oczekuję na wklejenie i analizę arkusza...</p>
						</div>
					) : (
						<div className="animate-in fade-in flex flex-col gap-5 duration-300">
							{missingStudents.length > 0 || missingProjects.length > 0 ? (
								<div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6">
									<div className="mb-4 flex items-center gap-3 text-red-700">
										<ExclamationTriangleFill size={28} className="shrink-0" />
										<h3 className="text-xl font-extrabold">Zatrzymano: Braki w bazie!</h3>
									</div>
									<p className="mb-4 text-sm font-medium text-red-600">
										Nie mogę zaimportować statusów, ponieważ poniższe osoby lub projekty nie istnieją w głównej bazie
										danych.
									</p>

									{missingStudents.length > 0 && (
										<div className="mb-4">
											<h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
												<PersonXFill /> Brakujący Uczniowie:
											</h4>
											<div className="flex flex-wrap gap-2">
												{missingStudents.map((s, i) => (
													<span key={i} className="rounded bg-white px-2 py-1 text-xs font-bold text-red-700 shadow-sm">
														{s}
													</span>
												))}
											</div>
										</div>
									)}

									{missingProjects.length > 0 && (
										<div className="mb-4">
											<h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
												<FileEarmarkXFill /> Brakujące Projekty:
											</h4>
											<div className="flex flex-wrap gap-2">
												{missingProjects.map((p, i) => (
													<span key={i} className="rounded bg-white px-2 py-1 text-xs font-bold text-red-700 shadow-sm">
														{p}
													</span>
												))}
											</div>
										</div>
									)}

									<div className="mt-6 flex flex-col gap-3 border-t border-red-200 pt-4">
										<p className="text-sm font-bold text-red-800">Jak to naprawić?</p>
										<ul className="ml-5 list-disc text-sm text-red-700">
											<li>Upewnij się, że w Excelu nie ma literówek w imionach, nazwiskach lub kodach projektów.</li>
											<li>Jeśli to nowe rekordy, dodaj je najpierw do systemu.</li>
										</ul>

										<div className="mt-2 flex flex-col gap-2 sm:flex-row">
											{missingStudents.length > 0 && (
												<button
													onClick={() => navigate('/uczniowie')}
													className="flex-1 cursor-pointer rounded-lg bg-red-100 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-200"
												>
													Przejdź do bazy Uczniów
												</button>
											)}
											{missingProjects.length > 0 && (
												<button
													onClick={() => navigate('/admin/projekty')}
													className="flex-1 cursor-pointer rounded-lg bg-red-100 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-200"
												>
													Przejdź do bazy Projektów
												</button>
											)}
										</div>
									</div>
								</div>
							) : (
								<>
									<div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800">
										<CheckCircleFill size={28} className="shrink-0" />
										<div>
											<p className="text-lg font-bold">Gotowe do migracji: {parsedData.studentNames.length} uczniów</p>
											<p className="mt-1 text-xs leading-relaxed font-medium">{parsedData.studentNames.join(', ')}</p>
										</div>
									</div>

									<div className="flex items-center gap-3 rounded-lg border border-green-100 bg-green-50 p-4 text-green-800">
										<CheckCircleFill size={28} className="shrink-0" />
										<div>
											<p className="text-lg font-bold">Zidentyfikowano {parsedData.rows.length} projektów</p>
											<p className="mt-1 text-xs font-medium">Brakujące pozycje wywołają alarm w kolejnym kroku.</p>
										</div>
									</div>

									<button
										onClick={handleImport}
										disabled={isImporting}
										className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 p-4 text-lg font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
									>
										{isImporting ? 'Migrowanie danych...' : 'Zatwierdź i Wykonaj Migrację'}
									</button>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
