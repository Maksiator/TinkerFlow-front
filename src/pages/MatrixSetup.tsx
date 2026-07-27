import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GroupCard } from '../components/GroupCard';
import {
	LayersFill,
	ChevronDown,
	ChevronUp,
	PlusLg,
	PencilSquare,
	Trash,
	XLg,
	PlusCircleFill,
	GripVertical,
	Search,
} from 'react-bootstrap-icons';
import { groupService, type Group } from '../api/groupService';
import { trainerListService, type TrainerList } from '../api/trainerListService';
import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

export function MatrixSetup() {
	const navigate = useNavigate();

	const [groups, setGroups] = useState<Group[]>([]);
	const [trainerLists, setTrainerLists] = useState<TrainerList[]>([]);
	const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Wyszukiwarki
	const [searchMain, setSearchMain] = useState('');
	const [searchModal, setSearchModal] = useState('');

	const [expandedListId, setExpandedListId] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingListId, setEditingListId] = useState<string | null>(null);

	const [listFormData, setListFormData] = useState<{ name: string; groupIds: string[]; targetDay: number | null }>({
		name: '',
		groupIds: [],
		targetDay: null,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const DAYS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

	useEffect(() => {
		let isMounted = true;

		const fetchInitialData = async () => {
			setIsLoading(true);
			try {
				const [fetchedGroups, fetchedLists] = await Promise.all([
					groupService.getAll(),
					trainerListService.getMyLists(),
				]);

				if (isMounted) {
					setGroups(fetchedGroups);
					setTrainerLists(fetchedLists);

					if (fetchedLists.length > 0) {
						setExpandedListId(fetchedLists[0].id);
					}
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error('Błąd pobierania danych z serwera');
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

	const refreshLists = async () => {
		try {
			const updatedLists = await trainerListService.getMyLists();
			setTrainerLists(updatedLists);
		} catch (error) {
			console.error(error);
			toast.error('Błąd odświeżania list.');
		}
	};

	const handleSelectGroupManually = (id: string) => {
		setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((groupId) => groupId !== id) : [...prev, id]));
	};

	const generateMatrix = (groupsToLoad: Group[]) => {
		if (groupsToLoad.length === 0) {
			toast.error('Brak grup do załadowania!');
			return;
		}

		const groupIds = groupsToLoad.map((g) => g.id).join(',');
		const firstGroupId = groupsToLoad[0].id;

		navigate(`/matryca/widok?groups=${groupIds}&active=${firstGroupId}`);
	};

	const openCreateModal = () => {
		setEditingListId(null);
		setListFormData({ name: '', groupIds: [], targetDay: null });
		setSearchModal(''); // Czyścimy wyszukiwarkę przy otwarciu
		setIsModalOpen(true);
	};

	const openEditModal = (list: TrainerList) => {
		setEditingListId(list.id);
		setListFormData({
			name: list.name,
			groupIds: list.groups.map((g) => g.id),
			targetDay: list.targetDay ?? null,
		});
		setSearchModal(''); // Czyścimy wyszukiwarkę przy otwarciu
		setIsModalOpen(true);
	};

	const handleAddGroupToList = (groupId: string) => {
		setListFormData((prev) => ({
			...prev,
			groupIds: [...prev.groupIds, groupId],
		}));
	};

	const handleRemoveGroupFromList = (groupId: string) => {
		setListFormData((prev) => ({
			...prev,
			groupIds: prev.groupIds.filter((id) => id !== groupId),
		}));
	};

	// Obsługa Drag & Drop
	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const startIndex = result.source.index;
		const endIndex = result.destination.index;
		if (startIndex === endIndex) return;

		setListFormData((prev) => {
			const newIds = Array.from(prev.groupIds);
			const [movedGroup] = newIds.splice(startIndex, 1);
			newIds.splice(endIndex, 0, movedGroup);
			return { ...prev, groupIds: newIds };
		});
	};

	const handleSaveList = async (e: React.FormEvent) => {
		e.preventDefault();
		if (listFormData.groupIds.length === 0) {
			toast.error('Musisz wybrać przynajmniej jedną grupę!');
			return;
		}

		setIsSubmitting(true);
		try {
			if (editingListId) {
				await trainerListService.update(editingListId, listFormData);
				toast.success('Lista zaktualizowana!');
			} else {
				await trainerListService.create(listFormData);
				toast.success('Nowa lista utworzona!');
			}
			await refreshLists();
			setIsModalOpen(false);
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas zapisywania listy.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteList = async (id: string, name: string) => {
		if (!window.confirm(`Czy na pewno chcesz usunąć listę "${name}"? Grupy w niej zawarte pozostaną w systemie.`))
			return;

		try {
			await trainerListService.delete(id);
			toast.success('Lista usunięta.');
			setTrainerLists((prev) => prev.filter((l) => l.id !== id));
		} catch (error) {
			console.error(error);
			toast.error('Nie udało się usunąć listy.');
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-full animate-pulse items-center justify-center p-10 font-bold text-slate-400">
				Pobieranie konfiguracji matrycy...
			</div>
		);
	}

	// Filtrowanie Główne
	const filteredMainGroups = groups.filter(
		(g) =>
			g.name.toLowerCase().includes(searchMain.toLowerCase()) ||
			g.branchName.toLowerCase().includes(searchMain.toLowerCase()),
	);

	// Filtrowanie Modal
	const availableGroups = groups.filter((g) => !listFormData.groupIds.includes(g.id));
	const filteredAvailableGroups = availableGroups.filter(
		(g) =>
			g.name.toLowerCase().includes(searchModal.toLowerCase()) ||
			g.branchName.toLowerCase().includes(searchModal.toLowerCase()),
	);

	const selectedGroupsWithDetails = listFormData.groupIds
		.map((id) => groups.find((g) => g.id === id))
		.filter((g): g is Group => g !== undefined);

	return (
		<div className="relative min-h-full p-4 pb-32 md:p-8">
			{/* NAGŁÓWEK */}
			<div className="mx-auto mb-8 flex max-w-6xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="text-3xl font-extrabold text-slate-800">Twoje Matryce</h1>
					<p className="font-medium text-slate-500">Zarządzaj harmonogramami i generuj zestawienia projektów.</p>
				</div>
				<button
					onClick={openCreateModal}
					className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-blue-700 md:w-auto"
				>
					<PlusLg /> Stwórz nową listę
				</button>
			</div>

			<div className="mx-auto max-w-6xl">
				{/* LISTY TRENERA */}
				{trainerLists.length === 0 ? (
					<div className="mb-10 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
						<p className="text-slate-500">Nie masz jeszcze żadnych zapisanych list grup.</p>
						<button onClick={openCreateModal} className="mt-4 font-bold text-blue-600 hover:underline">
							Dodaj listę (np. "Soboty Kraków")
						</button>
					</div>
				) : (
					<div className="mb-12 flex flex-col gap-4">
						{trainerLists.map((list) => {
							const isExpanded = expandedListId === list.id;
							return (
								<div
									key={list.id}
									className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all"
								>
									<div
										onClick={() => setExpandedListId(isExpanded ? null : list.id)}
										className="flex cursor-pointer items-center justify-between bg-slate-50 p-4 transition-colors hover:bg-slate-100 md:p-5"
									>
										<div className="flex flex-wrap items-center gap-4">
											<h2 className="text-lg font-bold text-slate-800">{list.name}</h2>
											<span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold text-slate-600 uppercase">
												Grup: {list.groups.length}
											</span>
											{list.targetDay != null && (
												<span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
													{DAYS[list.targetDay]}
												</span>
											)}
										</div>

										<div className="flex items-center gap-2 md:gap-4">
											<div className="hidden items-center gap-1 border-r border-slate-300 pr-4 md:flex">
												<button
													onClick={(e) => {
														e.stopPropagation();
														openEditModal(list);
													}}
													className="cursor-pointer rounded-lg p-2 text-slate-400 hover:text-blue-600"
													title="Edytuj listę"
												>
													<PencilSquare size={18} />
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteList(list.id, list.name);
													}}
													className="cursor-pointer rounded-lg p-2 text-slate-400 hover:text-red-600"
													title="Usuń listę"
												>
													<Trash size={18} />
												</button>
											</div>
											<button
												onClick={(e) => {
													e.stopPropagation();
													generateMatrix(list.groups);
												}}
												className="flex cursor-pointer items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-600"
											>
												<LayersFill /> <span className="hidden md:inline">Generuj Matrycę</span>
											</button>
											<div className="ml-2 text-slate-400 transition-transform duration-200">
												{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
											</div>
										</div>
									</div>

									{isExpanded && (
										<div className="animate-in slide-in-from-top-2 border-t border-slate-100 bg-white p-5 duration-200 md:p-6">
											<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
												{list.groups.map((group, index) => (
													<div key={group.id} className="relative">
														<div className="absolute -top-2 -left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shadow-sm">
															{index + 1}
														</div>
														<GroupCard
															id={group.id}
															name={group.name}
															location={group.branchName}
															isSelected={true}
															onSelect={() => {}}
														/>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

				{/* WSZYSTKIE GRUPY DO WYBORU RĘCZNEGO Z WYSZUKIWARKĄ */}
				<div className="mt-12 border-t border-slate-200 pt-8">
					<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
						<h3 className="text-xl font-bold text-slate-800">Wszystkie dostępne grupy (Wybór ręczny)</h3>
						<div className="relative w-full md:w-72">
							<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
							<input
								type="text"
								placeholder="Szukaj grupy lub oddziału..."
								value={searchMain}
								onChange={(e) => setSearchMain(e.target.value)}
								className="w-full rounded-lg border border-slate-300 py-2.5 pr-4 pl-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							/>
						</div>
					</div>

					{filteredMainGroups.length === 0 ? (
						<div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">
							Nie znaleziono grup pasujących do wyszukiwania.
						</div>
					) : (
						<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
							{filteredMainGroups.map((group) => (
								<GroupCard
									key={group.id}
									id={group.id}
									name={group.name}
									location={group.branchName}
									isSelected={selectedGroupIds.includes(group.id)}
									onSelect={handleSelectGroupManually}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			{/* FLOATING BAR */}
			{selectedGroupIds.length > 0 && (
				<div className="animate-in slide-in-from-bottom-10 fixed right-0 bottom-0 left-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md duration-300 md:left-64">
					<div className="mx-auto flex max-w-6xl items-center justify-between px-4">
						<div>
							<span className="hidden text-sm text-slate-500 sm:inline">Wybrano ręcznie grup: </span>
							<span className="ml-2 text-xl font-bold text-blue-600">{selectedGroupIds.length}</span>
						</div>
						<button
							onClick={() => generateMatrix(groups.filter((g) => selectedGroupIds.includes(g.id)))}
							className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95"
						>
							<LayersFill /> Generuj Matrycę Niestandardową
						</button>
					</div>
				</div>
			)}

			{/* ZAAWANSOWANY MODAL LISTY Z D&D ORAZ WYSZUKIWARKĄ */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="animate-in zoom-in flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl duration-200">
						<div className="flex items-center justify-between border-b border-slate-100 p-6">
							<h2 className="text-xl font-bold text-slate-800">
								{editingListId ? 'Edytuj listę grup' : 'Stwórz nową listę'}
							</h2>
							<button
								onClick={() => setIsModalOpen(false)}
								className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100"
							>
								<XLg />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
							<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Nazwa listy</label>
									<input
										type="text"
										value={listFormData.name}
										onChange={(e) => setListFormData({ ...listFormData, name: e.target.value })}
										placeholder="np. Poniedziałki"
										className="w-full rounded-lg border border-slate-300 bg-white p-3 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
									/>
								</div>
								<div>
									<label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Dzień tygodnia</label>
									<select
										value={listFormData.targetDay === null ? '' : listFormData.targetDay}
										onChange={(e) =>
											setListFormData({
												...listFormData,
												targetDay: e.target.value === '' ? null : Number(e.target.value),
											})
										}
										className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
									>
										<option value="">Brak stałego dnia</option>
										{DAYS.map((day, idx) => (
											<option key={idx} value={idx}>
												{day}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
								{/* KOLUMNA 1: Dostępne Grupy z Wyszukiwarką */}
								<div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
									<div className="mb-3 flex flex-col gap-2">
										<h3 className="text-sm font-bold text-slate-700">Dostępne grupy</h3>
										<div className="relative">
											<Search className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" size={14} />
											<input
												type="text"
												placeholder="Szukaj..."
												value={searchModal}
												onChange={(e) => setSearchModal(e.target.value)}
												className="w-full rounded-md border border-slate-200 py-1.5 pr-3 pl-8 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
											/>
										</div>
									</div>
									<div className="flex max-h-87.5 flex-col gap-2 overflow-y-auto pr-2">
										{filteredAvailableGroups.length === 0 ? (
											<div className="p-4 text-center text-xs text-slate-400">Brak wyników do wyboru.</div>
										) : (
											filteredAvailableGroups.map((group) => (
												<div
													key={group.id}
													onClick={() => handleAddGroupToList(group.id)}
													className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50"
												>
													<div className="overflow-hidden">
														<div className="truncate font-bold text-slate-800">{group.name}</div>
														<div className="text-[10px] font-semibold text-slate-500 uppercase">{group.branchName}</div>
													</div>
													<PlusCircleFill className="text-xl text-blue-500" />
												</div>
											))
										)}
									</div>
								</div>

								{/* KOLUMNA 2: Wybrane Grupy (Drag & Drop) */}
								<div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50 p-4">
									<h3 className="mb-3 text-sm font-bold text-blue-800">Wybrane grupy (Ułóż kolejność)</h3>

									{selectedGroupsWithDetails.length === 0 ? (
										<div className="flex-1 p-4 text-center text-xs text-blue-400">
											Kliknij na grupę po lewej stronie, aby ją dodać.
										</div>
									) : (
										<div className="max-h-87.5 overflow-y-auto pr-2">
											<DragDropContext onDragEnd={handleDragEnd}>
												<Droppable droppableId="selected-groups-list">
													{(provided) => (
														<div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col gap-2">
															{selectedGroupsWithDetails.map((group, index) => (
																<Draggable key={group.id} draggableId={group.id} index={index}>
																	{(provided, snapshot) => (
																		<div
																			ref={provided.innerRef}
																			{...provided.draggableProps}
																			className={`flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 transition-shadow ${
																				snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'shadow-sm'
																			}`}
																		>
																			<div className="flex items-center gap-3 overflow-hidden">
																				<div
																					{...provided.dragHandleProps}
																					className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
																				>
																					<GripVertical size={20} />
																				</div>
																				<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
																					{index + 1}
																				</div>
																				<div className="overflow-hidden">
																					<div className="truncate font-bold text-slate-800">{group.name}</div>
																					<div className="text-[10px] font-semibold text-slate-500 uppercase">
																						{group.branchName}
																					</div>
																				</div>
																			</div>

																			<button
																				onClick={() => handleRemoveGroupFromList(group.id)}
																				className="cursor-pointer rounded p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
																				title="Usuń z listy"
																			>
																				<Trash />
																			</button>
																		</div>
																	)}
																</Draggable>
															))}
															{provided.placeholder}
														</div>
													)}
												</Droppable>
											</DragDropContext>
										</div>
									)}
								</div>
							</div>
						</div>

						<div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-6">
							<button
								onClick={() => setIsModalOpen(false)}
								className="cursor-pointer px-6 py-2.5 font-bold text-slate-500 transition-colors hover:text-slate-700"
							>
								Anuluj
							</button>
							<button
								onClick={handleSaveList}
								disabled={isSubmitting || !listFormData.name.trim() || listFormData.groupIds.length === 0}
								className="cursor-pointer rounded-lg bg-blue-600 px-8 py-2.5 font-bold text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
							>
								{isSubmitting ? 'Zapisywanie...' : 'Zapisz listę'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
