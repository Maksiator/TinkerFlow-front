import { useState, useEffect } from 'react';
import { systemSettingsService, type SystemSettings } from '../api/systemSettingsService';
import toast from 'react-hot-toast';
import { GearFill, ShieldLockFill, CalendarEvent, PrinterFill } from 'react-bootstrap-icons';

export function AdminSettings() {
	const [settings, setSettings] = useState<SystemSettings>({
		substituteDaysBefore: 2,
		substituteDaysAfter: 2,
		printDeadlineDays: 0,
		currentAcademicYear: '2024/2025'
	});

	const [initialSettings, setInitialSettings] = useState<SystemSettings | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	
	// Stan dla operacji Zamknięcia Roku
	const [academicYear, setAcademicYear] = useState('');
	const [isClosingYear, setIsClosingYear] = useState(false);
	const [isUndoingYear, setIsUndoingYear] = useState(false);

	useEffect(() => {
		let isMounted = true;
		const fetchSettings = async () => {
			try {
				const data = await systemSettingsService.getSettings();
				if (isMounted) {
					setSettings(data);
					setInitialSettings(data);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) toast.error('Błąd pobierania ustawień systemowych.');
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchSettings();
		return () => {
			isMounted = false;
		};
	}, []);

	const [blockingData, setBlockingData] = useState<any[] | null>(null);

	const handleSaveSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSaving(true);

		try {
			const updated = await systemSettingsService.updateSettings(settings);
			setSettings(updated);
			setInitialSettings(updated);
			toast.success('Ustawienia systemowe zostały zapisane.');
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas zapisu ustawień.');
		} finally {
			setIsSaving(false);
		}
	};

	const handleCloseYear = async () => {
		if (!academicYear) {
			toast.error('Wpisz nazwę roku szkolnego (np. 2025/2026).');
			return;
		}

		if (!window.confirm(`Czy na pewno chcesz zamknąć rok ${academicYear}? Uczniowie zostaną wypisani z grup, a niezakończone projekty usunięte.`)) {
			return;
		}

		setIsClosingYear(true);
		try {
			const res = await systemSettingsService.closeAcademicYear(academicYear);
			toast.success(res.message);
			setAcademicYear('');
		} catch (error: any) {
			console.error(error);
			const responseData = error.response?.data;
			
			if (responseData?.blockingProjects && Array.isArray(responseData.blockingProjects)) {
				// Pokaż modal z pogrupowanymi błędami
				setBlockingData(responseData.blockingProjects);
				toast.error(responseData.message || 'Zakończenie roku zablokowane ze względu na otwarte projekty.');
			} else {
				toast.error(responseData?.message || 'Błąd podczas zamykania roku.');
			}
		} finally {
			setIsClosingYear(false);
		}
	};

	const handleUndoCloseYear = async () => {
		if (!academicYear) {
			toast.error('Wpisz nazwę roku szkolnego (np. 2025/2026), który chcesz przywrócić.');
			return;
		}

		if (!window.confirm(`OSTRZEŻENIE! Czy na pewno chcesz COFNĄĆ operację dla roku ${academicYear}? Uczniowie wrócą do swoich dawnych grup.`)) {
			return;
		}

		setIsUndoingYear(true);
		try {
			const res = await systemSettingsService.undoCloseAcademicYear(academicYear);
			toast.success(res.message);
			setAcademicYear('');
		} catch (error: any) {
			console.error(error);
			toast.error(error.response?.data?.message || 'Błąd podczas cofania zamknięcia roku.');
		} finally {
			setIsUndoingYear(false);
		}
	};

	const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

	if (isLoading)
		return (
			<div className="flex h-64 items-center justify-center p-10 font-bold text-slate-400">
				<span className="animate-pulse">Pobieranie konfiguracji serwera...</span>
			</div>
		);

	// Logika grupowania do modala
	const renderBlockingModal = () => {
		if (!blockingData) return null;
		
		const groupedByGroup = blockingData.reduce((acc: any, curr: any) => {
			if (!acc[curr.groupName]) acc[curr.groupName] = {};
			if (!acc[curr.groupName][curr.studentName]) acc[curr.groupName][curr.studentName] = [];
			acc[curr.groupName][curr.studentName].push(curr);
			return acc;
		}, {});

		const handleDownloadTxt = () => {
			let content = `Raport blokujących projektów - ${new Date().toLocaleDateString()}\n\n`;
			
			Object.entries(groupedByGroup).forEach(([groupName, students]: any) => {
				content += `=== Grupa: ${groupName} ===\n`;
				Object.entries(students).forEach(([studentName, projects]: any) => {
					content += `${studentName}:\n`;
					projects.forEach((p: any) => {
						content += `  - ${p.projectName} (${p.status})\n`;
					});
				});
				content += `\n`;
			});

			const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `raport_blokujacych_projektow_${new Date().toISOString().slice(0,10)}.txt`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		};

		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
				<div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
					<div className="border-b border-slate-100 p-6 flex justify-between items-start">
						<div>
							<h2 className="text-xl font-bold text-red-600">Zakończenie roku zablokowane</h2>
							<p className="mt-2 text-sm text-slate-500">
								Następujące projekty mają status wskazujący na to, że muszą zostać wydrukowane lub wydane. 
								Rozwiąż te problemy, zanim zakończysz rok szkolny.
							</p>
						</div>
						<button
							onClick={handleDownloadTxt}
							className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200"
							title="Pobierz listę jako plik .txt"
						>
							Pobierz .txt
						</button>
					</div>
					<div className="flex-1 overflow-y-auto p-6">
						{Object.entries(groupedByGroup).map(([groupName, students]: any) => (
							<div key={groupName} className="mb-6 last:mb-0">
								<h3 className="mb-3 border-b-2 border-slate-100 pb-2 text-lg font-bold text-slate-800">
									Grupa: <span className="text-blue-600">{groupName}</span>
								</h3>
								<div className="flex flex-col gap-4 pl-2">
									{Object.entries(students).map(([studentName, projects]: any) => (
										<div key={studentName} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
											<h4 className="mb-2 font-bold text-slate-700">{studentName}</h4>
											<ul className="flex flex-col gap-2 pl-2">
												{projects.map((p: any, idx: number) => (
													<li key={idx} className="flex flex-wrap items-center justify-between gap-2 text-sm">
														<span className="font-medium text-slate-600">• {p.projectName}</span>
														<span className={`rounded-md px-2 py-1 text-xs font-bold ${p.status.includes('Wysłane') ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
															{p.status}
														</span>
													</li>
												))}
											</ul>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
					<div className="border-t border-slate-100 bg-slate-50 p-6">
						<button
							type="button"
							onClick={() => setBlockingData(null)}
							className="w-full rounded-xl bg-slate-800 py-3 font-bold text-white transition-all hover:bg-slate-900"
						>
							Zrozumiałem, zamknij
						</button>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-8">
			{renderBlockingModal()}
			<div className="mb-8">
				<h1 className="flex items-center gap-3 text-3xl font-extrabold text-slate-800">
					<ShieldLockFill className="text-red-500" /> Ustawienia Globalne
				</h1>
				<p className="text-slate-500">Konfiguracja parametrów wpływających na działanie całego systemu.</p>
			</div>

			{/* Jeden formularz kontrolujący cały stan ustawień globalnych */}
			<form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
				{/* SEKCJA ZASTĘPSTW */}
				<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-800">
						<CalendarEvent className="text-blue-600" /> Dostęp dla Zastępców
					</h2>
					<p className="mb-6 text-sm text-slate-500">
						Określ domyślne widełki czasowe (ile dni przed i po zajęciach), w których trener zastępczy będzie miał
						dostęp do Matrycy danej grupy.
					</p>

					<div className="grid max-w-md grid-cols-2 gap-4">
						<div>
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Dni PRZED zajęciami</label>
							<input
								type="number"
								min="0"
								max="30"
								required
								value={settings.substituteDaysBefore}
								onChange={(e) => {
									const val = parseInt(e.target.value, 10);
									setSettings({ ...settings, substituteDaysBefore: isNaN(val) ? 0 : val });
								}}
								className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 transition-all outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Dni PO zajęciach</label>
							<input
								type="number"
								min="0"
								max="30"
								required
								value={settings.substituteDaysAfter}
								onChange={(e) => {
									const val = parseInt(e.target.value, 10);
									setSettings({ ...settings, substituteDaysAfter: isNaN(val) ? 0 : val });
								}}
								className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 transition-all outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
							/>
						</div>
					</div>
				</div>

				{/* SEKCJA WYDRUKÓW */}
				<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-800">
						<PrinterFill className="text-purple-600" /> System Wydruków
					</h2>
					<p className="mb-6 text-sm text-slate-500">
						Skonfiguruj globalne parametry dotyczące zleceń wydruków 3D dla studentów w systemie.
					</p>

					<div className="grid max-w-md grid-cols-2 gap-4">
						<div>
							<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">
								Dni na realizację (Deadline)
							</label>
							<input
								type="number"
								min="0"
								max="90"
								required
								value={settings.printDeadlineDays}
								onChange={(e) => {
									const val = parseInt(e.target.value, 10);
									setSettings({ ...settings, printDeadlineDays: isNaN(val) ? 0 : val });
								}}
								className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 transition-all outline-none focus:border-purple-500 focus:bg-white focus:ring-1 focus:ring-purple-500"
							/>
						</div>
					</div>
				</div>

				{/* SEKCJA ROKU SZKOLNEGO */}
				<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-800">
						<CalendarEvent className="text-green-600" /> Rok Szkolny
					</h2>
					<p className="mb-6 text-sm text-slate-500">
						Zdefiniuj aktualny rok szkolny (np. 2024/2025). System będzie używał go m.in. jako domyślnej wartości podczas wypisywania uczniów w trakcie roku.
					</p>
					<div className="max-w-md">
						<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">
							Aktywny Rok Szkolny
						</label>
						<input
							type="text"
							required
							value={settings.currentAcademicYear}
							onChange={(e) => setSettings({ ...settings, currentAcademicYear: e.target.value })}
							placeholder="np. 2024/2025"
							className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 transition-all outline-none focus:border-green-500 focus:bg-white focus:ring-1 focus:ring-green-500"
						/>
					</div>
				</div>

				{/* ZBIORCZY PRZYCISK AKCJI */}
				<div className="mt-2 flex justify-end">
					<button
						type="submit"
						disabled={isSaving || !hasChanges}
						className="flex w-full max-w-md cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-800 py-3.5 font-bold text-white shadow-md transition-all hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
					>
						<GearFill className={isSaving ? 'animate-spin' : ''} />
						{isSaving ? 'Zapisywanie...' : 'Zapisz konfigurację'}
					</button>
				</div>
			</form>

			{/* SEKCJA ZAMKNIĘCIA ROKU */}
			<div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
				<h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-red-700">
					Zakończenie Roku Szkolnego
				</h2>
				<p className="mb-6 text-sm text-red-600">
					Operacja masowa: Wypisuje wszystkich uczniów z obecnych grup, przenosi ich do historii oraz usuwa niezakończone projekty (zaplanowane lub w trakcie).
					<strong> Uwaga: Zastosuj tylko na sam koniec roku edukacyjnego!</strong>
				</p>

				<div className="grid max-w-md gap-4">
					<div>
						<label className="mb-1.5 block text-xs font-bold text-red-700 uppercase">
							Rok Szkolny (np. 2025/2026)
						</label>
						<input
							type="text"
							value={academicYear}
							onChange={(e) => setAcademicYear(e.target.value)}
							placeholder="Wpisz rok szkolny..."
							className="w-full rounded-xl border border-red-300 bg-white p-3 transition-all outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
						/>
					</div>
					
					<div className="flex gap-4">
						<button
							type="button"
							onClick={handleCloseYear}
							disabled={isClosingYear || isUndoingYear}
							className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white shadow-md transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
						>
							{isClosingYear ? 'Przetwarzanie...' : 'Zakończ Rok'}
						</button>
						<button
							type="button"
							onClick={handleUndoCloseYear}
							disabled={isClosingYear || isUndoingYear}
							className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-600 bg-transparent py-3 font-bold text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:border-red-300 disabled:text-red-300"
						>
							{isUndoingYear ? 'Cofanie...' : 'Cofnij operację'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
