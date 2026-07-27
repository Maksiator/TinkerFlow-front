import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircleFill, ExclamationCircleFill } from 'react-bootstrap-icons';
import { projectService, type ProjectRequest } from '../api/projectService';
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

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newText = e.target.value;
		setRawText(newText);

		if (!newText.trim()) {
			setPreviewRows([]);
			return;
		}

		const lines = newText.split('\n').filter((l) => l.trim().length > 0);

		const parsed: PreviewProject[] = lines.map((line, index) => {
			let name = '';
			let code = '';
			let isValid = false;

			// Magiczny Regex: szuka na końcu linijki ciągu np. "C1 L2" lub "c10 l2-3"
			// i ignoruje wielkość liter (flaga 'i').
			const match = line.match(/(c\d+\s+l\d+(?:-\d+)?)$/i);

			if (match) {
				code = match[1].toUpperCase(); // Ujednolicamy kod do dużych liter
				name = line.substring(0, match.index).trim(); // Wszystko przed kodem to nazwa

				// Oczyszczamy nazwę z ewentualnych tabulatorów czy średników na końcu
				name = name.replace(/[\t;,-]+$/, '').trim();
				isValid = name.length > 0 && code.length > 0;
			} else {
				// Jeśli nie znaleziono kodu na końcu, traktujemy całą linijkę jako błędną
				name = line.trim();
			}

			return {
				id: `proj-${index}`,
				name,
				code,
				sequenceOrder: index + 1, // Automatyczne nadawanie kolejności wg wierszy
				isValid,
			};
		});

		setPreviewRows(parsed);
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
		<div className="mx-auto max-w-5xl p-4 md:p-8">
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
												<td className="p-3 font-mono text-slate-400">#{row.sequenceOrder}</td>
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
