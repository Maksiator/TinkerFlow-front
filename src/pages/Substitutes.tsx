import { useState, useEffect } from 'react';
import { groupService, type Group } from '../api/groupService';
import { userService, UserRole, type User } from '../api/userService';
import { substituteService, type SubstituteResponse } from '../api/substituteService';
import { systemSettingsService, type SystemSettings } from '../api/systemSettingsService';
import toast from 'react-hot-toast';
import { CalendarEvent, TrashFill, PlusLg, PersonCheckFill, Search, CheckCircleFill } from 'react-bootstrap-icons';

export function Substitutes() {
	const [groups, setGroups] = useState<Group[]>([]);
	const [trainers, setTrainers] = useState<User[]>([]);
	const [substitutes, setSubstitutes] = useState<SubstituteResponse[]>([]);
	const [settings, setSettings] = useState<SystemSettings>({
		substituteDaysBefore: 2,
		substituteDaysAfter: 2,
		printDeadlineDays: 6,
		currentAcademicYear: '2024/2025'
	});
	const [isLoading, setIsLoading] = useState(true);

	// Stan formularza
	const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
	const [selectedTrainerId, setSelectedTrainerId] = useState('');
	const [lessonDate, setLessonDate] = useState('');
	const [validFrom, setValidFrom] = useState('');
	const [validUntil, setValidUntil] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [groupSearch, setGroupSearch] = useState('');
	const [trainerSearch, setTrainerSearch] = useState('');

	useEffect(() => {
		let isMounted = true;

		const fetchData = async () => {
			setIsLoading(true);
			try {
				const [groupsData, usersData, subsData, settingsData] = await Promise.all([
					groupService.getAll(),
					userService.getAll(undefined, 1, 9999),
					substituteService.getAll(),
					systemSettingsService.getSettings(),
				]);

				if (isMounted) {
					const availableTrainers = (usersData.items || []).filter(
						(u: User) => u.role === UserRole.Trainer || u.role === UserRole.Coordinator,
					);
					setGroups(groupsData);
					setTrainers(availableTrainers);
					setSubstitutes(subsData);
					setSettings(settingsData);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error('Nie udało się załadować danych wejściowych.');
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
	}, []);

	// NOWA AUTOMATYKA: Przeliczanie w momencie akcji użytkownika (bez zbędnych renderów)
	const handleLessonDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newDateStr = e.target.value;
		setLessonDate(newDateStr); // Zapisujemy datę lekcji

		if (newDateStr) {
			// Od razu wyliczamy i ustawiamy widełki
			const date = new Date(newDateStr);

			const from = new Date(date);
			from.setDate(date.getDate() - settings.substituteDaysBefore);

			const until = new Date(date);
			until.setDate(date.getDate() + settings.substituteDaysAfter);

			setValidFrom(from.toISOString().split('T')[0]);
			setValidUntil(until.toISOString().split('T')[0]);
		} else {
			// Jeśli użytkownik wyczyścił datę, czyścimy też widełki
			setValidFrom('');
			setValidUntil('');
		}
	};

	const toggleGroup = (id: string) => {
		setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((gId) => gId !== id) : [...prev, id]));
	};

	const handleAddSubstitute = async (e: React.FormEvent) => {
		e.preventDefault();

		if (selectedGroupIds.length === 0 || !selectedTrainerId || !lessonDate || !validFrom || !validUntil) {
			toast.error('Wypełnij wszystkie wymagane pola (w tym daty dostępu)!');
			return;
		}

		setIsSubmitting(true);
		try {
			await Promise.all(
				selectedGroupIds.map((groupId) =>
					substituteService.create({
						groupId,
						trainerId: selectedTrainerId,
						lessonDate: lessonDate,
						validFrom: validFrom,
						validUntil: validUntil,
					}),
				),
			);

			toast.success(`Zastępstwo przypisane do ${selectedGroupIds.length} grup!`);

			// Czyszczenie formularza po sukcesie
			setSelectedGroupIds([]);
			setSelectedTrainerId('');
			setLessonDate('');
			setGroupSearch('');
			setTrainerSearch('');

			const updatedSubs = await substituteService.getAll();
			setSubstitutes(updatedSubs);
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas dodawania zastępstw. Sprawdź konsolę.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteSubstitute = async (id: string) => {
		if (!window.confirm('Czy na pewno chcesz usunąć to zastępstwo?')) return;

		try {
			await substituteService.delete(id);
			toast.success('Zastępstwo usunięte.');
			setSubstitutes((prev) => prev.filter((s) => s.id !== id));
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się usunąć zastępstwa.');
		}
	};

	const filteredGroups = groups.filter(
		(g) =>
			g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
			g.branchName.toLowerCase().includes(groupSearch.toLowerCase()),
	);

	const filteredTrainers = trainers.filter((t) =>
		`${t.firstName} ${t.lastName}`.toLowerCase().includes(trainerSearch.toLowerCase()),
	);

	if (isLoading)
		return <div className="p-8 text-center font-bold text-slate-400">Inicjalizacja modułu zastępstw...</div>;

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold text-slate-800">Zarządzanie Zastępstwami</h1>
				<p className="text-slate-500">Przypisuj trenerów na zajęcia i kontroluj ich okno dostępu do Matrycy.</p>
			</div>

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
				{/* LEWA KOLUMNA - FORMULARZ */}
				<div className="lg:col-span-1">
					<div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-800">
							<PersonCheckFill className="text-blue-600" /> Nowe zastępstwo
						</h2>

						<form onSubmit={handleAddSubstitute} className="flex flex-col gap-5">
							{/* 1. DATA ZAJĘĆ */}
							<div>
								<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Data zajęć</label>
								<input
									type="date"
									required
									value={lessonDate}
									onChange={handleLessonDateChange}
									className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								/>
							</div>

							{/* 2. CUSTOMOWE WIDEŁKI CZASOWE */}
							<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">Dostęp od</label>
										<input
											type="date"
											required
											value={validFrom}
											onChange={(e) => setValidFrom(e.target.value)}
											className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">Dostęp do</label>
										<input
											type="date"
											required
											value={validUntil}
											onChange={(e) => setValidUntil(e.target.value)}
											className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-blue-500"
										/>
									</div>
								</div>
								<p className="mt-2 text-[10px] text-slate-400 italic">
									*Daty uzupełniane automatycznie wg ustawień globalnych. Możesz je edytować.
								</p>
							</div>

							{/* 3. GRUPY (MASOWE WYBIERANIE) */}
							<div>
								<div className="mb-1.5 flex items-center justify-between">
									<label className="block text-xs font-bold text-slate-500 uppercase">Grupy</label>
									{selectedGroupIds.length > 0 && (
										<span className="text-xs font-bold text-blue-600">Wybrano: {selectedGroupIds.length}</span>
									)}
								</div>
								<div className="relative mb-2">
									<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={14} />
									<input
										type="text"
										placeholder="Szukaj i klikaj grupy..."
										value={groupSearch}
										onChange={(e) => setGroupSearch(e.target.value)}
										className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
									/>
								</div>

								<div className="scrollbar-thin flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-slate-300 p-2">
									{filteredGroups.length === 0 ? (
										<div className="p-4 text-center text-xs text-slate-400">Brak wyników...</div>
									) : (
										filteredGroups.map((g) => {
											const isSelected = selectedGroupIds.includes(g.id);
											return (
												<div
													key={g.id}
													onClick={() => toggleGroup(g.id)}
													className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 text-sm transition-all duration-200 ${
														isSelected
															? 'border-blue-200 bg-blue-50 font-bold text-blue-700 shadow-sm'
															: 'border-transparent bg-white text-slate-700 hover:bg-slate-50'
													}`}
												>
													<span>
														{g.name} <span className="ml-1 text-[10px] text-slate-400 uppercase">({g.branchName})</span>
													</span>
													{isSelected && <CheckCircleFill className="text-blue-500" />}
												</div>
											);
										})
									)}
								</div>
							</div>

							{/* 4. TRENER ZASTĘPCZY */}
							<div>
								<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase">Trener zastępczy</label>
								<div className="relative mb-2">
									<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={14} />
									<input
										type="text"
										placeholder="Szukaj trenera..."
										value={trainerSearch}
										onChange={(e) => setTrainerSearch(e.target.value)}
										className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
									/>
								</div>
								<select
									required
									size={4}
									value={selectedTrainerId}
									onChange={(e) => setSelectedTrainerId(e.target.value)}
									className="scrollbar-thin w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-blue-500"
								>
									{filteredTrainers.map((t) => (
										<option key={t.id} value={t.id} className="cursor-pointer rounded-md p-2 hover:bg-slate-100">
											{t.firstName} {t.lastName}
										</option>
									))}
								</select>
							</div>

							<button
								type="submit"
								disabled={isSubmitting || selectedGroupIds.length === 0}
								className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
							>
								<PlusLg /> {isSubmitting ? 'Zapisywanie...' : 'Zapisz zastępstwo'}
							</button>
						</form>
					</div>
				</div>

				{/* PRAWA KOLUMNA - LISTA ZASTĘPSTW */}
				<div className="lg:col-span-2">
					<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
							<h2 className="font-bold text-slate-800">Aktywne i zaplanowane zastępstwa</h2>
							<span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
								{substitutes.length}
							</span>
						</div>

						{substitutes.length === 0 ? (
							<div className="m-6 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
								Brak zaplanowanych zastępstw w systemie.
							</div>
						) : (
							<div className="divide-y divide-slate-100">
								{substitutes.map((sub) => {
									const lessonDate = new Date(sub.lessonDate).toLocaleDateString('pl-PL');
									const validFrom = new Date(sub.validFrom).toLocaleDateString('pl-PL');
									const validUntil = new Date(sub.validUntil).toLocaleDateString('pl-PL');

									return (
										<div
											key={sub.id}
											className="flex flex-col justify-between gap-4 p-6 transition-colors hover:bg-slate-50 md:flex-row md:items-center"
										>
											<div>
												<div className="mb-2 flex items-center gap-3">
													<span className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
														<CalendarEvent size={14} /> {lessonDate}
													</span>
													<h3 className="text-lg font-bold text-slate-800">{sub.groupName}</h3>
												</div>
												<div className="flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:gap-6">
													<p>
														<span className="font-semibold">Zastępca:</span> {sub.trainerName}
													</p>
													<p className="flex items-center text-xs text-slate-400">
														(Dostęp: {validFrom} - {validUntil})
													</p>
												</div>
											</div>

											<button
												onClick={() => handleDeleteSubstitute(sub.id)}
												className="shrink-0 cursor-pointer rounded-xl p-3 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
												title="Usuń to zastępstwo"
											>
												<TrashFill size={20} />
											</button>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
