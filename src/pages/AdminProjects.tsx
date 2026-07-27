import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	PlusLg,
	PencilSquare,
	Trash,
	Search,
	ArrowClockwise,
	XLg,
	GripVertical,
	CloudArrowUpFill,
	EyeFill,
} from 'react-bootstrap-icons';
import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { projectService, type Project } from '../api/projectService';

interface UsageData {
	id: string;
	name: string;
	code: string;
	students: {
		studentId: string;
		fullName: string;
		groupName: string;
		status: number;
	}[];
}

export function AdminProjects() {
	const navigate = useNavigate();
	const [projects, setProjects] = useState<Project[]>([]);
	const [search, setSearch] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingProject, setEditingProject] = useState<Project | null>(null);

	const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
	const [usageData, setUsageData] = useState<UsageData | null>(null);
	const [isUsageLoading, setIsUsageLoading] = useState(false);

	const [formData, setFormData] = useState({
		name: '',
		code: '',
		sequenceOrder: 1,
		isPractice: false,
		isYearBoundary: false,
	});

	useEffect(() => {
		let isMounted = true;
		const fetchInitialData = async () => {
			try {
				const data = await projectService.getAll();
				if (isMounted) {
					setProjects(data.sort((a, b) => a.sequenceOrder - b.sequenceOrder));
					setError(null);
				}
			} catch (err) {
				console.error(err);
				if (isMounted) setError('Błąd połączenia z API.');
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchInitialData();
		return () => {
			isMounted = false;
		};
	}, []);

	const handleRetry = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await projectService.getAll();
			setProjects(data.sort((a, b) => a.sequenceOrder - b.sequenceOrder));
		} catch (err) {
			console.error(err);
			setError('Błąd połączenia z API.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleShowUsage = async (id: string) => {
		setIsUsageModalOpen(true);
		setIsUsageLoading(true);
		setUsageData(null);
		try {
			const data = await projectService.getUsage(id);
			setUsageData(data as unknown as UsageData);
		} catch (err) {
			console.error(err);
			toast.error('Błąd pobierania szczegółów projektu.');
			setIsUsageModalOpen(false);
		} finally {
			setIsUsageLoading(false);
		}
	};

	const openEditModal = (project: Project) => {
		setEditingProject(project);
		setFormData({
			name: project.name,
			code: project.code,
			sequenceOrder: project.sequenceOrder,
			isPractice: project.isPractice || false,
			isYearBoundary: project.isYearBoundary || false,
		});
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setEditingProject(null);
		setFormData({ name: '', code: '', sequenceOrder: 1, isPractice: false, isYearBoundary: false });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			if (editingProject) {
				await projectService.update(editingProject.id, formData);
				setProjects((prev) =>
					prev
						.map((p) => (p.id === editingProject.id ? { ...p, ...formData } : p))
						.sort((a, b) => a.sequenceOrder - b.sequenceOrder),
				);
				toast.success('Projekt zaktualizowany!');
			} else {
				const newOrder = formData.sequenceOrder || projects.length + 1;
				const created = await projectService.create({ ...formData, sequenceOrder: newOrder });
				setProjects((prev) => [...prev, created].sort((a, b) => a.sequenceOrder - b.sequenceOrder));
				toast.success('Projekt dodany!');
			}
			handleCloseModal();
		} catch (err) {
			console.error(err);
			toast.error('Operacja nieudana. Sprawdź konsolę.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (
			window.confirm(
				'Czy na pewno chcesz usunąć ten projekt z bazy danych? Upewnij się wcześniej (ikona oka), że nikt z niego nie korzysta!',
			)
		) {
			const deletePromise = projectService.delete(id);
			toast.promise(deletePromise, {
				loading: 'Usuwanie...',
				success: 'Usunięto pomyślnie!',
				error: (err) => (err instanceof Error ? err.message : 'Błąd podczas usuwania (projekt pewnie jest w użyciu).'),
			});
			try {
				await deletePromise;
				setProjects((prev) => prev.filter((p) => p.id !== id));
			} catch (error) {
				console.error(error);
			}
		}
	};

	const handleDragEnd = async (result: DropResult) => {
		if (!result.destination) return;

		const startIndex = result.source.index;
		const endIndex = result.destination.index;
		if (startIndex === endIndex) return;

		const updatedList = Array.from(projects);
		const [movedProject] = updatedList.splice(startIndex, 1);
		updatedList.splice(endIndex, 0, movedProject);

		const finalProjects = updatedList.map((p, index) => ({
			...p,
			sequenceOrder: index + 1,
		}));

		const changedProjects = finalProjects.filter((newProj) => {
			const oldProj = projects.find((p) => p.id === newProj.id);
			return oldProj && oldProj.sequenceOrder !== newProj.sequenceOrder;
		});

		setProjects(finalProjects);

		if (changedProjects.length === 0) return;

		try {
			await Promise.all(
				changedProjects.map((p) => {
					const updatePayload = {
						name: p.name,
						code: p.code,
						sequenceOrder: p.sequenceOrder,
						isPractice: p.isPractice,
						isYearBoundary: p.isYearBoundary,
					};
					return projectService.update(p.id, updatePayload);
				}),
			);
			toast.success(`Zapisano kolejność (${changedProjects.length} elem.)`);
		} catch (err) {
			console.error('Błąd zapisu kolejności:', err);
			toast.error('Błąd synchronizacji z serwerem .NET');
			handleRetry();
		}
	};

	const filteredProjects = projects.filter(
		(p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()),
	);

	const isSearchActive = search.length > 0;

	return (
		<div className="p-8">
			<div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="text-3xl font-extrabold text-slate-800">Baza Projektów</h1>
					<p className="font-medium text-slate-500">Zarządzaj modelami i ich kolejnością.</p>
				</div>

				<div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
					<button
						onClick={() => navigate('/admin/projekty/masowo')}
						className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-orange-600 md:w-auto"
					>
						<CloudArrowUpFill /> Masowy import
					</button>
					<button
						onClick={() => setIsModalOpen(true)}
						className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-blue-700 md:w-auto"
					>
						<PlusLg /> Dodaj Projekt
					</button>
				</div>
			</div>

			{isLoading && (
				<div className="flex animate-pulse justify-center p-10 text-blue-600">
					<p className="text-xl font-bold">Pobieranie danych z serwera...</p>
				</div>
			)}

			{error && !isLoading && (
				<div className="mb-6 flex items-center justify-between rounded-r-lg border-l-4 border-red-500 bg-red-50 p-4 shadow-sm">
					<p className="font-bold text-red-700">{error}</p>
					<button
						onClick={handleRetry}
						className="flex cursor-pointer items-center gap-2 rounded px-4 py-2 text-red-700 hover:bg-red-100"
					>
						<ArrowClockwise /> Spróbuj ponownie
					</button>
				</div>
			)}

			{!isLoading && !error && (
				<>
					<div className="mb-6 flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="relative flex-1">
							<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
							<input
								type="text"
								placeholder="Szukaj po nazwie lub kodzie..."
								className="w-full rounded-lg border border-slate-200 py-2 pr-4 pl-10 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
					</div>

					{isSearchActive && (
						<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-600">
							Tryb wyszukiwania jest aktywny. Zmiana kolejności (Drag & Drop) została zablokowana. Wyczyszczenie paska
							wyszukiwania przywróci tę funkcję.
						</div>
					)}

					<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
						<DragDropContext onDragEnd={handleDragEnd}>
							<table className="w-full text-left text-sm">
								<thead className="border-b border-slate-200 bg-slate-50">
									<tr>
										<th className="w-24 px-6 py-4 text-xs font-bold text-slate-400 uppercase">Sort</th>
										<th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Kod</th>
										<th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Nazwa Projektu</th>
										<th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase">Akcje</th>
									</tr>
								</thead>
								<Droppable droppableId="projects-table" isDropDisabled={isSearchActive}>
									{(provided) => (
										<tbody className="divide-y divide-slate-100" ref={provided.innerRef} {...provided.droppableProps}>
											{filteredProjects.map((project, index) => (
												<Draggable
													key={project.id}
													draggableId={project.id}
													index={index}
													isDragDisabled={isSearchActive}
												>
													{(provided) => (
														<tr
															ref={provided.innerRef}
															{...provided.draggableProps}
															style={{ ...provided.draggableProps.style }}
															className="group hover:bg-slate-50/50"
														>
															<td className="px-6 py-4">
																<div className="flex items-center gap-3">
																	<span className="w-6 font-bold text-slate-400">#{project.sequenceOrder}</span>
																	<div {...provided.dragHandleProps} className="cursor-grab text-slate-300">
																		<GripVertical size={20} />
																	</div>
																</div>
															</td>
															<td className="px-6 py-4 font-mono font-bold text-blue-600">{project.code}</td>
															<td className="w-full px-6 py-4 font-bold text-slate-700">
																<div className="flex items-center gap-2">
																	<span>{project.name}</span>
																	{project.isPractice && (
																		<span className="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-black tracking-tighter text-yellow-800 uppercase">
																			Łatwe
																		</span>
																	)}
																	{project.isYearBoundary && (
																		<span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-black tracking-tighter text-white uppercase">
																			Koniec Roku
																		</span>
																	)}
																</div>
															</td>
															<td className="px-6 py-4 text-right">
																<div className="flex justify-end gap-2">
																	<button
																		onClick={() => handleShowUsage(project.id)}
																		className="cursor-pointer p-2 text-slate-400 transition-colors hover:text-blue-600"
																		title="Sprawdź ilu uczniów to robi"
																	>
																		<EyeFill size={18} />
																	</button>
																	<button
																		onClick={() => openEditModal(project)}
																		className="cursor-pointer p-2 text-slate-400 transition-colors hover:text-green-600"
																	>
																		<PencilSquare size={18} />
																	</button>
																	<button
																		onClick={() => handleDelete(project.id)}
																		className="cursor-pointer p-2 text-slate-400 transition-colors hover:text-red-600"
																	>
																		<Trash size={18} />
																	</button>
																</div>
															</td>
														</tr>
													)}
												</Draggable>
											))}
											{provided.placeholder}
										</tbody>
									)}
								</Droppable>
							</table>
						</DragDropContext>
					</div>
				</>
			)}

			{/* MODAL USAGE */}
			{isUsageModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
						<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6">
							<h2 className="text-xl font-bold text-slate-800">
								Szczegóły: <span className="text-blue-600">{usageData?.name || 'Ładowanie...'}</span>
							</h2>
							<button
								onClick={() => setIsUsageModalOpen(false)}
								className="cursor-pointer text-slate-400 hover:text-slate-600"
							>
								<XLg size={24} />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-6">
							{isUsageLoading ? (
								<div className="animate-pulse py-10 text-center font-medium text-slate-500">Sprawdzanie bazy...</div>
							) : usageData ? (
								<div>
									<div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
										<p className="text-sm font-medium text-blue-800">Liczba przypisanych uczniów:</p>
										<p className="text-3xl font-black text-blue-900">{usageData.students?.length || 0}</p>
									</div>

									{usageData.students?.length > 0 ? (
										<div className="space-y-2">
											<h3 className="text-sm font-bold text-slate-700">Lista uczniów:</h3>
											<ul className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
												{usageData.students.map((s, i) => (
													<li key={i} className="flex justify-between border-b border-slate-100 py-1 last:border-0">
														<span className="font-medium">{s.fullName}</span>
														<span className="text-xs text-slate-400">{s.groupName}</span>
													</li>
												))}
											</ul>
											<p className="mt-2 text-xs font-bold text-red-500">
												Nie możesz usunąć tego projektu, dopóki ci uczniowie go posiadają.
											</p>
										</div>
									) : (
										<p className="rounded-xl border border-green-200 bg-green-50 p-4 text-center font-bold text-green-600">
											Projekt nie ma przypisanych żadnych uczniów. Możesz go bezpiecznie usunąć!
										</p>
									)}
								</div>
							) : (
								<div className="text-center font-bold text-red-500">Nie udało się załadować danych.</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* MODAL EDYCJI / DODAWANIA */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-6 flex items-center justify-between">
							<h2 className="text-xl font-bold text-slate-800">
								{editingProject ? 'Edytuj projekt' : 'Dodaj nowy projekt'}
							</h2>
							<button
								onClick={handleCloseModal}
								className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
							>
								<XLg />
							</button>
						</div>
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Nazwa Projektu</label>
								<input
									type="text"
									required
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-1"
								/>
							</div>
							<div>
								<label className="mb-1 block text-sm font-bold text-slate-700">Kod Projektu</label>
								<input
									type="text"
									required
									value={formData.code}
									onChange={(e) => setFormData({ ...formData, code: e.target.value })}
									className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-1"
								/>
							</div>
							{!editingProject && (
								<div>
									<label className="mb-1 block text-sm font-bold text-slate-700">Kolejność startowa</label>
									<input
										type="number"
										value={formData.sequenceOrder}
										onChange={(e) => setFormData({ ...formData, sequenceOrder: parseInt(e.target.value) || 1 })}
										className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:border-blue-500 focus:ring-1"
									/>
								</div>
							)}

							<div className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
								<h4 className="text-sm font-bold text-slate-700">Flagi w matrycy</h4>
								<label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
									<input
										type="checkbox"
										checked={formData.isPractice}
										onChange={(e) => setFormData({ ...formData, isPractice: e.target.checked })}
										className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
									/>
									<span>Projekt dodatkowy (Łatwy / Żółty)</span>
								</label>

								<label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
									<input
										type="checkbox"
										checked={formData.isYearBoundary}
										onChange={(e) => setFormData({ ...formData, isYearBoundary: e.target.checked })}
										className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
									/>
									<span>Koniec roku (Gruba czarna linia)</span>
								</label>
							</div>

							<div className="mt-4 flex gap-3">
								<button
									type="button"
									onClick={handleCloseModal}
									className="flex-1 cursor-pointer rounded-lg bg-slate-100 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
								>
									Anuluj
								</button>
								<button
									type="submit"
									disabled={isSubmitting}
									className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 disabled:bg-blue-400"
								>
									{isSubmitting ? 'Zapisywanie...' : editingProject ? 'Zapisz zmiany' : 'Stwórz Projekt'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
