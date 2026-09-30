import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircleFill, ExclamationCircleFill, ArrowDownCircleFill, SortNumericDown } from 'react-bootstrap-icons';
import { projectService, type ProjectRequest, ProjectSoftware } from '../api/projectService';
import toast from 'react-hot-toast';

interface PreviewProject {
	id: string;
	name: string;
	code: string;
	sequenceOrder: number;
	isValid: boolean;
}

export function AdminProjectsBulkAdd() {
	const navigate = useNavigate();
	const [rawText, setRawText] = useState('');
	const [previewRows, setPreviewRows] = useState<PreviewProject[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [software, setSoftware] = useState<ProjectSoftware>(ProjectSoftware.Tinkercad);
	const [isAdvanced, setIsAdvanced] = useState(false);

	// Stan kolejności z bazy danych
	const [existingMaxOrder, setExistingMaxOrder] = useState<number>(0);
	const [existingCount, setExistingCount] = useState<number>(0);
	const [orderMode, setOrderMode] = useState<'end' | 'custom'>('end');
	const [customStartOrder, setCustomStartOrder] = useState<number>(1);

	useEffect(() => {
		projectService.getAll().then((projects) => {
			const maxOrder = projects.length > 0 ? Math.max(...projects.map((p) => p.sequenceOrder)) : 0;
			setExistingMaxOrder(maxOrder);
			setExistingCount(projects.length);
			setCustomStartOrder(maxOrder + 1);
		}).catch((err) => {
			console.error('Błąd pobierania projektów:', err);
		});
	}, []);

	const parseTextToRows = (text: string, mode: 'end' | 'custom', customStart: number, maxOrder: number): PreviewProject[] => {
		if (!text.trim()) return [];
		const baseOrder = mode === 'end' ? maxOrder + 1 : (Number(customStart) || 1);
		const lines = text.split('\n').filter((l) => l.trim().length > 0);

		return lines.map((line, index) => {
			let name = '';
			let code = '';
			let isValid = false;

			const match = line.match(/(c\d+\s+l\d+(?:-\d+)?)$/i);

			if (match) {
				code = match[1].toUpperCase();
				name = line.substring(0, match.index).trim();
				name = name.replace(/[\t;,-]+$/, '').trim();
				isValid = name.length > 0 && code.length > 0;
			} else {
				name = line.trim();
			}

			return {
				id: `proj-${index}`,
				name,
				code,
				sequenceOrder: baseOrder + index,
				isValid,
			};
		});
	};

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newText = e.target.value;
		setRawText(newText);
		setPreviewRows(parseTextToRows(newText, orderMode, customStartOrder, existingMaxOrder));
	};

	const handleOrderModeChange = (mode: 'end' | 'custom') => {
		setOrderMode(mode);
		setPreviewRows(parseTextToRows(rawText, mode, customStartOrder, existingMaxOrder));
	};

	const handleCustomStartChange = (val: number) => {
		const safeVal = Math.max(1, val);
		setCustomStartOrder(safeVal);
		setPreviewRows(parseTextToRows(rawText, 'custom', safeVal, existingMaxOrder));
	};

	const handleSubmit = async () => {
		const invalidCount = previewRows.filter((r) => !r.isValid).length;
		if (invalidCount > 0) {
			toast.error(`Masz ${invalidCount} błędnych wierszy. Popraw format.`);
			return;
		}

		setIsSaving(true);
		try {
			const payload: ProjectRequest[] = previewRows.map((r) => ({
				name: r.name,
				code: r.code,
				sequenceOrder: r.sequenceOrder,
				isPractice: false,
				isYearBoundary: false,
				software: software,
				isAdvanced: software === ProjectSoftware.SolidWorks ? true : isAdvanced,
			}));

			await projectService.createBulk(payload);
			toast.success(`Zapisano ${payload.length} projektów!`);
			navigate('/admin/projekty');
		} catch (error) {
			toast.error('Błąd podczas zapisu projektów.');
			console.error(error);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
			<button
				onClick={() => navigate('/admin/projekty')}
				className="mb-6 flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-600"
			>
				<ArrowLeft /> Powrót do listy projektów
			</button>

			<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 className="mb-2 text-2xl font-bold text-slate-800">Import Harmonogramu</h1>
				<p className="mb-6 text-slate-500">
					Wklej harmonogram lekcji. System sam znajdzie kod na końcu wiersza. <br />
					Oczekiwany format: <strong>Nazwa Projektu C1 L2</strong> lub <strong>Nazwa C1 L2-3</strong>
				</p>

				{/* Opcje oprogramowania i zaawansowania */}
				<div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
					<div>
						<label className="mb-1 block text-sm font-bold text-slate-700">Oprogramowanie dla importowanych</label>
						<select
							value={software}
							onChange={(e) => {
								const sw = parseInt(e.target.value, 10) as ProjectSoftware;
								setSoftware(sw);
								if (sw === ProjectSoftware.SolidWorks) {
									setIsAdvanced(true);
								}
							}}
							className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-medium outline-none focus:border-blue-500"
						>
							<option value={ProjectSoftware.Tinkercad}>Tinkercad</option>
							<option value={ProjectSoftware.SolidWorks}>SolidWorks</option>
						</select>
					</div>

					<div className="flex flex-col justify-center">
						<label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
							<input
								type="checkbox"
								checked={isAdvanced}
								disabled={software === ProjectSoftware.SolidWorks}
								onChange={(e) => setIsAdvanced(e.target.checked)}
								className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
							/>
							<span>Oznacz jako Projekty Spoza harmonogramu</span>
						</label>
						<p className="mt-1 text-xs text-slate-500">
							{software === ProjectSoftware.SolidWorks
								? 'SolidWorks jest automatycznie oznaczany jako projekt zaawansowany.'
								: 'Dostępne w grupach zaawansowanych oraz jako opcjonalne projekty dla szybszych uczniów w grupach standardowych.'}
						</p>
					</div>
				</div>

				{/* Numeracja i kolejność w bazie */}
				<div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div>
							<h3 className="text-sm font-bold text-slate-800">Pozycja / Numeracja w harmonogramie</h3>
							<p className="text-xs text-slate-500">
								Wybierz, w którym miejscu listy mają znaleźć się nowe projekty (obecnie w bazie jest {existingCount} projektów, max Lp. #{existingMaxOrder}).
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => handleOrderModeChange('end')}
								className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
									orderMode === 'end'
										? 'bg-blue-600 text-white shadow-sm'
										: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
								}`}
							>
								<ArrowDownCircleFill size={14} />
								Dodaj na samym końcu (od #{existingMaxOrder + 1})
							</button>

							<button
								type="button"
								onClick={() => handleOrderModeChange('custom')}
								className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
									orderMode === 'custom'
										? 'bg-blue-600 text-white shadow-sm'
										: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
								}`}
							>
								<SortNumericDown size={14} />
								Własny numer startowy
							</button>

							{orderMode === 'custom' && (
								<div className="flex items-center gap-2 animate-in fade-in duration-200">
									<span className="text-xs font-semibold text-slate-600">Od numeru:</span>
									<input
										type="number"
										min="1"
										value={customStartOrder}
										onChange={(e) => handleCustomStartChange(parseInt(e.target.value) || 1)}
										className="w-24 rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold outline-none focus:border-blue-500"
									/>
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
					{/* LEWA: Wklejanie */}
					<div className="flex flex-col gap-4">
						<textarea
							value={rawText}
							onChange={handleTextChange}
							className="h-96 w-full rounded-lg border border-slate-300 p-4 font-mono text-sm leading-relaxed transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							placeholder="Zdalnie sterowany samochód wyścigowy C1 L1&#10;Mechaniczne ramię robota C1 L2-3"
						/>
					</div>

					{/* PRAWA: Podgląd */}
					<div className="flex h-full flex-col">
						<div className="min-h-80 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
							{previewRows.length === 0 ? (
								<div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
									Brak danych do podglądu.
								</div>
							) : (
								<table className="w-full text-left text-sm">
									<thead className="sticky top-0 bg-slate-200 text-slate-600 shadow-sm">
										<tr>
											<th className="p-3 font-bold">Kolejność</th>
											<th className="p-3 font-bold">Status</th>
											<th className="p-3 font-bold">Nazwa</th>
											<th className="p-3 font-bold">Kod</th>
										</tr>
									</thead>
									<tbody>
										{previewRows.map((row) => (
											<tr key={row.id} className="border-b border-slate-100 bg-white hover:bg-slate-50">
												<td className="p-3">
													<div className="flex items-center gap-1">
														<span className="font-mono text-xs text-slate-400">#</span>
														<input
															type="number"
															min="1"
															value={row.sequenceOrder}
															onChange={(e) => {
																const val = parseInt(e.target.value) || 1;
																setPreviewRows((prev) =>
																	prev.map((r) => (r.id === row.id ? { ...r, sequenceOrder: val } : r))
																);
															}}
															className="w-16 rounded border border-slate-200 px-2 py-1 text-xs font-bold font-mono outline-none focus:border-blue-500"
															title="Zmień pozycję dla tego projektu"
														/>
													</div>
												</td>
												<td className="p-3">
													{row.isValid ? (
														<CheckCircleFill className="text-green-500" title="Poprawny" />
													) : (
														<ExclamationCircleFill className="text-red-500" title="Brak prawidłowego kodu (Cx Lx)" />
													)}
												</td>
												<td className="p-3 font-semibold text-slate-800">
													{row.name || <span className="text-xs text-red-500">Błąd formatu</span>}
												</td>
												<td className="p-3 font-mono text-blue-600">{row.code || '-'}</td>
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
								className="cursor-pointer rounded-lg bg-orange-500 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-400"
							>
								{isSaving ? 'Zapisywanie...' : `Zapisz ${previewRows.filter((r) => r.isValid).length} projektów`}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
