import React, { useState, useMemo } from 'react';
import { XLg, PrinterFill, Scissors, EyeFill } from 'react-bootstrap-icons';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import { type PrintBatchResponse } from '../api/printBatchService';

export interface PrintLabelsModalProps {
	isOpen: boolean;
	onClose: () => void;
	batch: PrintBatchResponse | null;
}

export const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({ isOpen, onClose, batch }) => {
	const currentUser = authService.getCurrentUser();
	const isAdmin = currentUser?.role === UserRole.Admin;

	const [includeProjects, setIncludeProjects] = useState(false);
	const [oneLabelPerModel, setOneLabelPerModel] = useState(false);

	// Przygotowanie listy etykiet do wydruku
	const labels = useMemo(() => {
		if (!batch || !batch.printJobs) return [];

		if (oneLabelPerModel) {
			return batch.printJobs.map((job) => ({
				id: job.id,
				studentName: job.studentName,
				groupName: batch.groupName,
				projects: [job.projectName],
			}));
		}

		// Domyślnie: 1 etykieta na ucznia (wszystkie jego modele do 1 woreczka)
		const map = new Map<string, { studentName: string; projects: string[] }>();
		for (const job of batch.printJobs) {
			const existing = map.get(job.studentName);
			if (existing) {
				existing.projects.push(job.projectName);
			} else {
				map.set(job.studentName, {
					studentName: job.studentName,
					projects: [job.projectName],
				});
			}
		}

		return Array.from(map.entries())
			.sort(([nameA], [nameB]) => nameA.localeCompare(nameB, 'pl'))
			.map(([studentName, data], index) => ({
				id: `${studentName}-${index}`,
				studentName: data.studentName,
				groupName: batch.groupName,
				projects: data.projects,
			}));
	}, [batch, oneLabelPerModel]);

	if (!isOpen || !batch || !isAdmin) return null;

	const handlePrint = () => {
		window.print();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
			{/* Style do wydruku czystego arkusza A4 */}
			<style>{`
				@media print {
					body * {
						visibility: hidden !important;
					}
					#printable-labels-sheet,
					#printable-labels-sheet * {
						visibility: visible !important;
					}
					#printable-labels-sheet {
						position: absolute !important;
						left: 0 !important;
						top: 0 !important;
						width: 210mm !important;
						min-height: 297mm !important;
						margin: 0 !important;
						padding: 8mm !important;
						background: #ffffff !important;
						box-shadow: none !important;
						z-index: 999999 !important;
					}
					.label-card-print {
						page-break-inside: avoid !important;
						break-inside: avoid !important;
					}
					@page {
						size: A4 portrait;
						margin: 0;
					}
				}
			`}</style>

			<div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl transition-all">
				{/* NAGŁÓWEK MODALU */}
				<div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
							<Scissors size={20} />
						</div>
						<div>
							<h2 className="text-lg font-extrabold text-slate-800">
								Drukuj etykiety do woreczków
								<span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
									Tylko Administrator
								</span>
							</h2>
							<p className="text-xs text-slate-500">
								Paczka: <span className="font-bold text-slate-700">{batch.groupName}</span> ({labels.length} etykiet)
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
					>
						<XLg size={18} />
					</button>
				</div>

				{/* PASEK OPCJI I PRZYCISK DRUKU */}
				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3">
					<div className="flex flex-wrap items-center gap-5 text-xs text-slate-700 font-medium">
						<label className="flex cursor-pointer items-center gap-2 select-none">
							<input
								type="checkbox"
								checked={oneLabelPerModel}
								onChange={(e) => setOneLabelPerModel(e.target.checked)}
								className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600"
							/>
							<span>Etykieta na każdy model (zamiast 1 na ucznia)</span>
						</label>

						<label className="flex cursor-pointer items-center gap-2 select-none">
							<input
								type="checkbox"
								checked={includeProjects}
								onChange={(e) => setIncludeProjects(e.target.checked)}
								className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600"
							/>
							<span>Dołącz nazwy projektów na karteczce</span>
						</label>
					</div>

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={onClose}
							className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
						>
							Zamknij
						</button>
						<button
							type="button"
							onClick={handlePrint}
							className="cursor-pointer flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-purple-700 active:scale-95"
						>
							<PrinterFill size={15} />
							Drukuj na A4
						</button>
					</div>
				</div>

				{/* PODGLĄD ARKUSZA A4 */}
				<div className="flex-1 overflow-y-auto bg-slate-100 p-6">
					<div className="mx-auto max-w-[210mm] rounded-lg border border-slate-200 bg-white p-6 shadow-md">
						<div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-400 font-medium">
							<span className="flex items-center gap-1.5">
								<EyeFill size={12} /> Podgląd wydruku A4 (linie przerywane wskazują linie cięcia dla gilotyny / nożyczek)
							</span>
							<span>Rozmiar etykiety: ~65 × 32 mm</span>
						</div>

						{/* ELEMENT DRUKOWALNY */}
						<div
							id="printable-labels-sheet"
							className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5"
							style={{ minHeight: '120mm' }}
						>
							{labels.map((label) => (
								<div
									key={label.id}
									className="label-card-print flex flex-col justify-center items-center text-center rounded-sm border-1.5 border-dashed border-slate-400 bg-white p-2.5 transition-colors"
									style={{
										width: '100%',
										minHeight: '32mm',
										boxSizing: 'border-box',
									}}
								>
									{/* Imię i nazwisko */}
									<div className="text-[14px] font-black uppercase tracking-wide text-slate-900 leading-tight">
										{label.studentName}
									</div>

									{/* Grupa */}
									<div className="mt-1 text-[11px] font-bold text-slate-600 leading-tight">
										{label.groupName}
									</div>

									{/* Opcjonalne nazwy projektów */}
									{includeProjects && label.projects.length > 0 && (
										<div className="mt-1 max-w-full text-[9px] font-medium text-slate-500 italic truncate">
											{label.projects.join(', ')}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
