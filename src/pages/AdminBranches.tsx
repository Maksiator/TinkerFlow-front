import { useState, useEffect } from 'react';
import { BuildingFill, PlusLg, PencilSquare, Trash3Fill, Search, XLg, InfoCircleFill } from 'react-bootstrap-icons';
import { branchService, type Branch } from '../api/branchService';
import toast from 'react-hot-toast';

export function AdminBranches() {
	const [branches, setBranches] = useState<Branch[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
	const [branchName, setBranchName] = useState('');

	// GŁÓWNY EFEKT ZGODNY Z TWOIM STANDARDEM
	useEffect(() => {
		let isMounted = true;

		const fetchBranches = async () => {
			try {
				const data = await branchService.getAll();
				if (isMounted) {
					setBranches(data);
				}
			} catch (error) {
				console.error(error); // ESLint zadowolony
				if (isMounted) {
					toast.error('Nie udało się pobrać listy oddziałów.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchBranches();

		return () => {
			isMounted = false;
		};
	}, []);

	// Pomocnicza funkcja do odświeżania listy po akcjach
	const refreshBranches = async () => {
		try {
			const data = await branchService.getAll();
			setBranches(data);
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas odświeżania listy.');
		}
	};

	const handleOpenModal = (branch?: Branch) => {
		if (branch) {
			setEditingBranch(branch);
			setBranchName(branch.name);
		} else {
			setEditingBranch(null);
			setBranchName('');
		}
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setEditingBranch(null);
		setBranchName('');
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!branchName.trim()) return;
		setIsSubmitting(true);

		try {
			if (editingBranch) {
				await branchService.update(editingBranch.id, { name: branchName });
				toast.success('Nazwa oddziału zaktualizowana!');
			} else {
				await branchService.create({ name: branchName });
				toast.success('Nowy oddział został dodany!');
			}
			await refreshBranches();
			handleCloseModal();
		} catch (error) {
			console.error(error);
			toast.error('Błąd podczas zapisywania oddziału.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (branch: Branch) => {
		if (branch.groupCount > 0) {
			toast.error(
				`Nie można usunąć oddziału "${branch.name}", ponieważ są do niego przypisane grupy (${branch.groupCount}).`,
			);
			return;
		}

		if (!window.confirm(`Czy na pewno chcesz usunąć oddział "${branch.name}"?`)) return;

		try {
			await branchService.delete(branch.id);
			toast.success('Oddział został usunięty.');
			await refreshBranches();
		} catch (error) {
			console.error(error);
			toast.error('Wystąpił błąd podczas usuwania.');
		}
	};

	const filteredBranches = branches.filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-8">
			{/* HEADER */}
			<div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="flex items-center gap-3 text-3xl font-extrabold text-slate-800">
						<BuildingFill className="text-blue-600" /> Oddziały
					</h1>
					<p className="text-sm font-medium text-slate-500">Zarządzaj lokalizacjami i strukturą Twojej firmy.</p>
				</div>
				<button
					onClick={() => handleOpenModal()}
					className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-700 active:scale-95"
				>
					<PlusLg /> Dodaj oddział
				</button>
			</div>

			{/* SEARCH BAR */}
			<div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="relative">
					<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Szukaj oddziału..."
						className="w-full rounded-lg border border-slate-300 py-3 pl-10 text-sm transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</div>
			</div>

			{/* LISTA ODDZIAŁÓW */}
			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="w-full text-left text-sm">
					<thead className="bg-slate-50 text-slate-500">
						<tr>
							<th className="p-4 text-[11px] font-bold tracking-wider uppercase">Nazwa lokalizacji</th>
							<th className="p-4 text-center text-[11px] font-bold tracking-wider uppercase">Liczba grup</th>
							<th className="p-4 text-right text-[11px] font-bold tracking-wider uppercase">Akcje</th>
						</tr>
					</thead>
					<tbody>
						{isLoading ? (
							<tr>
								<td colSpan={3} className="p-12 text-center font-bold text-slate-400">
									Pobieranie danych...
								</td>
							</tr>
						) : filteredBranches.length === 0 ? (
							<tr>
								<td colSpan={3} className="p-12 text-center text-slate-400">
									Brak zdefiniowanych oddziałów.
								</td>
							</tr>
						) : (
							filteredBranches.map((branch) => (
								<tr key={branch.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
									<td className="p-4 font-bold text-slate-700">{branch.name}</td>
									<td className="p-4 text-center">
										<span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
											{branch.groupCount} grup
										</span>
									</td>
									<td className="p-4 text-right">
										<div className="flex justify-end gap-2">
											<button
												onClick={() => handleOpenModal(branch)}
												className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
												title="Edytuj"
											>
												<PencilSquare size={18} />
											</button>
											<button
												onClick={() => handleDelete(branch)}
												className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
												title="Usuń"
											>
												<Trash3Fill size={18} />
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* RODO INFO BOX */}
			<div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 shadow-sm">
				<InfoCircleFill className="mt-0.5 shrink-0" />
				<p className="text-[11px] leading-relaxed">
					<strong>Zasady usuwania (RODO):</strong> Aby usunąć oddział, musisz najpierw usunąć lub przenieść wszystkie
					przypisane do niego grupy. Działanie to jest nieodwracalne i może wpłynąć na dostępność matryc dla trenerów w
					danym regionie.
				</p>
			</div>

			{/* MODAL EDIT/ADD */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
					<div className="animate-in fade-in zoom-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl duration-200">
						<div className="mb-6 flex items-center justify-between">
							<h2 className="text-xl font-bold text-slate-800">{editingBranch ? 'Edytuj oddział' : 'Nowy oddział'}</h2>
							<button onClick={handleCloseModal} className="cursor-pointer text-slate-400 hover:text-slate-600">
								<XLg size={20} />
							</button>
						</div>

						<form onSubmit={handleSubmit}>
							<div className="mb-6">
								<label className="mb-2 block text-xs font-bold tracking-tight text-slate-500 uppercase">
									Nazwa oddziału
								</label>
								<input
									type="text"
									autoFocus
									required
									value={branchName}
									onChange={(e) => setBranchName(e.target.value)}
									placeholder="np. Kraków - Podgórze"
									className="w-full rounded-lg border border-slate-300 p-3 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								/>
							</div>

							<div className="flex gap-3">
								<button
									type="button"
									onClick={handleCloseModal}
									className="flex-1 cursor-pointer rounded-lg bg-slate-100 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-200"
								>
									Anuluj
								</button>
								<button
									type="submit"
									disabled={isSubmitting || !branchName.trim()}
									className="flex-1 rounded-lg bg-blue-600 py-3 font-bold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
								>
									{isSubmitting ? 'Zapisywanie...' : editingBranch ? 'Zapisz zmiany' : 'Dodaj'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
