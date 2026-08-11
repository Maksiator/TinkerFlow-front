import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import { trainerListService, type TrainerList } from '../api/trainerListService';
import { substituteService, type SubstituteResponse } from '../api/substituteService';
import {
	PlayCircleFill,
	CalendarEventFill,
	PlusCircleFill,
	PeopleFill,
	LayersFill,
	ArrowLeftRight,
	ClockHistory,
} from 'react-bootstrap-icons';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

export function Dashboard() {
	const user = authService.getCurrentUser();
	const navigate = useNavigate();

	const [lists, setLists] = useState<TrainerList[]>([]);
	const [mySubstitutes, setMySubstitutes] = useState<SubstituteResponse[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Przekierowanie drukarza bezpośrednio na farmę druku
	useEffect(() => {
		if (user?.role === UserRole.Printer) {
			navigate('/farma', { replace: true });
		}
	}, [user, navigate]);

	const currentDayIndex = new Date().getDay();
	const canManage = user?.role === UserRole.Admin || user?.role === UserRole.Coordinator;

	const todayFormatted = new Intl.DateTimeFormat('pl-PL', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
	}).format(new Date());

	useEffect(() => {
		let isMounted = true;

		const fetchDashboardData = async () => {
			try {
				const [fetchedLists, fetchedSubstitutes] = await Promise.all([
					trainerListService.getMyLists(),
					substituteService.getMy(),
				]);

				if (isMounted) {
					setLists(fetchedLists);
					setMySubstitutes(fetchedSubstitutes);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) toast.error('Nie udało się pobrać niektórych danych pulpitu.');
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchDashboardData();

		return () => {
			isMounted = false;
		};
	}, []);

	const todayList = lists.find((l) => l.targetDay === currentDayIndex);
	const otherLists = lists.filter((l) => l.targetDay !== currentDayIndex);

	// GRUPOWANIE ZASTĘPSTW PO DACIE LEKCJI
	const groupedSubstitutes = mySubstitutes.reduce(
		(acc, sub) => {
			const dateKey = sub.lessonDate.split('T')[0];
			if (!acc[dateKey]) {
				acc[dateKey] = [];
			}
			acc[dateKey].push(sub);
			return acc;
		},
		{} as Record<string, typeof mySubstitutes>,
	);

	const groupedSubstitutesArray = Object.entries(groupedSubstitutes)
		.map(([date, subs]) => ({
			date,
			formattedDate: new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(
				new Date(date),
			),
			subs,
		}))
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	// STANDARDOWE URUCHAMIANIE LISTY (Zmienione na Query Params)
	const handleLaunchMatrix = (list: TrainerList) => {
		if (list.groups.length === 0) {
			toast.error('Ta lista nie ma przypisanych żadnych grup!');
			return;
		}

		const groupIds = list.groups.map((g) => g.id).join(',');
		const firstGroupId = list.groups[0].id;

		navigate(`/matryca/widok?groups=${groupIds}&active=${firstGroupId}`);
	};

	// ZBIORCZE URUCHAMIANIE ZASTĘPSTW (Zmienione na Query Params)
	const handleCreateBulkMatrix = (subsForDay: SubstituteResponse[]) => {
		try {
			const groupIds = subsForDay.map((s) => s.groupId).join(',');
			const firstGroupId = subsForDay[0].groupId;

			navigate(`/matryca/widok?groups=${groupIds}&active=${firstGroupId}`);
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się załadować matrycy dla tych zastępstw.');
		}
	};

	const formatDate = (dateString: string) => {
		return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' }).format(
			new Date(dateString),
		);
	};

	return (
		<div className="mx-auto flex max-w-7xl flex-col gap-8 p-4 md:p-8">
			{/* BANER POWITALNY */}
			<div className="animate-in fade-in slide-in-from-bottom-4 relative shrink-0 overflow-hidden rounded-3xl bg-linear-to-r from-blue-700 to-indigo-800 p-8 text-white shadow-lg duration-500">
				<div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white opacity-10 blur-3xl"></div>
				<div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<h1 className="mb-2 text-3xl font-extrabold tracking-tight">Cześć, {user?.firstName}! 👋</h1>
						<p className="text-lg font-medium text-blue-100 capitalize">
							Dzisiaj jest <span className="font-bold text-white">{todayFormatted}</span>.
						</p>
					</div>

					{canManage && (
						<div className="flex shrink-0 gap-2">
							<button
								onClick={() => navigate('/uczniowie/nowy')}
								className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/20 px-4 py-2 font-bold backdrop-blur-xs transition-colors hover:bg-white/30 active:scale-95"
							>
								<PlusCircleFill /> Uczeń
							</button>
							<button
								onClick={() => navigate('/grupy/nowa')}
								className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/20 px-4 py-2 font-bold backdrop-blur-xs transition-colors hover:bg-white/30 active:scale-95"
							>
								<PlusCircleFill /> Grupa
							</button>
						</div>
					)}
				</div>
			</div>

			{isLoading ? (
				<div className="animate-pulse p-10 text-center font-bold text-slate-400">Ładowanie Twojego pulpitu...</div>
			) : (
				<>
					{/* TWOJE ZASTĘPSTWA (Zgrupowane po dacie) */}
					{groupedSubstitutesArray.length > 0 && (
						<div className="animate-in fade-in slide-in-from-bottom-4 delay-100 duration-500">
							<div className="mb-4 flex items-center gap-2 text-slate-800">
								<ArrowLeftRight size={22} className="text-orange-500" />
								<h2 className="text-2xl font-bold">Zastępstwa zaplanowane dla Ciebie</h2>
							</div>
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
								{groupedSubstitutesArray.map((group) => (
									<div
										key={group.date}
										className="flex flex-col justify-between rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-sm transition-all hover:shadow-md"
									>
										<div className="mb-4 border-b border-orange-200/50 pb-3">
											<span className="flex items-center gap-2 text-sm font-bold text-orange-600">
												<CalendarEventFill size={16} /> Data zajęć: {group.formattedDate}
											</span>
										</div>

										<div className="mb-5 flex-1">
											<p className="mb-2 text-xs font-bold text-slate-500 uppercase">
												Obejmuje grupy ({group.subs.length}):
											</p>
											<ul className="flex flex-col gap-2">
												{group.subs.map((sub) => (
													<li key={sub.id} className="flex flex-col text-sm font-medium text-slate-700">
														<div className="flex items-center gap-2">
															<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"></span>
															<span>{sub.groupName}</span>
														</div>
														<div className="ml-3.5 flex items-center gap-1 text-[10px] font-bold tracking-tight text-orange-400 uppercase">
															<ClockHistory /> Dostęp: {formatDate(sub.validFrom)} - {formatDate(sub.validUntil)}
														</div>
													</li>
												))}
											</ul>
										</div>

										<button
											onClick={() => handleCreateBulkMatrix(group.subs)}
											className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-bold text-white shadow-sm transition-colors hover:bg-orange-700 active:scale-95"
										>
											<LayersFill /> Spakuj wszystko (Otwórz Matrycę)
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					{/* DZISIEJSZE ZAJĘCIA (TWOJA LISTA) */}
					<div className="animate-in fade-in slide-in-from-bottom-4 delay-150 duration-500">
						<div className="mb-4 flex items-center gap-2 text-slate-800">
							<CalendarEventFill size={22} className="text-blue-600" />
							<h2 className="text-2xl font-bold">Dzisiejsze zajęcia stałe</h2>
						</div>

						{todayList ? (
							<div className="flex flex-col items-start justify-between gap-6 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm md:flex-row md:items-center">
								<div>
									<h3 className="mb-1 text-xl font-extrabold text-blue-900">{todayList.name}</h3>
									<p className="font-medium text-blue-700">
										Liczba przypisanych grup: <strong>{todayList.groups.length}</strong>
									</p>
								</div>
								<button
									onClick={() => handleLaunchMatrix(todayList)}
									className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-3 rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-blue-700 active:scale-[0.98] md:w-auto"
								>
									<PlayCircleFill size={24} /> Uruchom Matrycę
								</button>
							</div>
						) : (
							<div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
								<p className="font-medium text-slate-500">
									Nie masz przypisanej żadnej stałej listy na dzisiejszy dzień.
								</p>
								<button
									onClick={() => navigate('/matryca')}
									className="mt-4 cursor-pointer font-bold text-blue-600 transition-colors hover:underline"
								>
									Skonfiguruj listę w panelu matrycy
								</button>
							</div>
						)}
					</div>

					{/* POZOSTAŁE LISTY */}
					{otherLists.length > 0 && (
						<div className="animate-in fade-in slide-in-from-bottom-4 delay-200 duration-500">
							<div className="mb-4 flex items-center gap-2 text-slate-800">
								<LayersFill size={22} className="text-slate-600" />
								<h2 className="text-2xl font-bold">Twoje pozostałe listy</h2>
							</div>

							<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
								{otherLists.map((list) => (
									<div
										key={list.id}
										className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
									>
										<div>
											<div className="mb-2 flex items-start justify-between">
												<h3 className="text-lg font-bold text-slate-800">{list.name}</h3>
												{list.targetDay != null && (
													<span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
														{DAYS_OF_WEEK[list.targetDay]}
													</span>
												)}
											</div>
											<p className="flex items-center gap-1 text-sm font-medium text-slate-500">
												<PeopleFill className="text-blue-400" /> {list.groups.length} grup
											</p>
										</div>
										<button
											onClick={() => handleLaunchMatrix(list)}
											className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
										>
											<PlayCircleFill /> Uruchom
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
