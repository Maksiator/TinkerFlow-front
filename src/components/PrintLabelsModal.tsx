import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XLg, PrinterFill, Scissors, EyeFill, LayersFill } from 'react-bootstrap-icons';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import { type PrintBatchResponse, PrintBatchState } from '../api/printBatchService';

export interface PrintLabelsModalProps {
	isOpen: boolean;
	onClose: () => void;
	allBatches: PrintBatchResponse[];
	selectedBatchIds: string[];
	onBatchIdsChange?: (newIds: string[]) => void;
}

export const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({
	isOpen,
	onClose,
	allBatches,
	selectedBatchIds,
	onBatchIdsChange,
}) => {
	const currentUser = authService.getCurrentUser();
	const isAdmin = currentUser?.role === UserRole.Admin;

	const [activeBatchIds, setActiveBatchIds] = useState<string[]>(selectedBatchIds);
	const [includeProjects, setIncludeProjects] = useState(false);
	const [oneLabelPerModel, setOneLabelPerModel] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setActiveBatchIds(selectedBatchIds);
		}
	}, [isOpen, selectedBatchIds]);

	// Paczki, które są aktualnie wybrane i mają wydruki
	const activeBatches = useMemo(() => {
		return allBatches.filter(
			(b) => activeBatchIds.includes(b.id) && b.status !== PrintBatchState.NoPrints && (b.printJobs?.length ?? 0) > 0
		);
	}, [allBatches, activeBatchIds]);

	const removeBatch = (batchId: string) => {
		const next = activeBatchIds.filter((id) => id !== batchId);
		setActiveBatchIds(next);
		onBatchIdsChange?.(next);
	};

	const clearAllSelected = () => {
		setActiveBatchIds([]);
		onBatchIdsChange?.([]);
	};

	// Przygotowanie listy etykiet ze wszystkich zaznaczonych paczek
	const labels = useMemo(() => {
		const currentBatches = activeBatches;
		const list: Array<{
			id: string;
			studentName: string;
			groupName: string;
			projects: string[];
		}> = [];

		for (const batch of currentBatches) {
			if (oneLabelPerModel) {
				for (const job of batch.printJobs) {
					list.push({
						id: `${batch.id}-${job.id}`,
						studentName: job.studentName,
						groupName: batch.groupName,
						projects: [job.projectName],
					});
				}
			} else {
				// 1 etykieta na ucznia w danej paczce
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
				const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'pl'));
				for (const [studentName, data] of sorted) {
					list.push({
						id: `${batch.id}-${studentName}`,
						studentName: data.studentName,
						groupName: batch.groupName,
						projects: data.projects,
					});
				}
			}
		}

		return list;
	}, [activeBatches, oneLabelPerModel]);

	if (!isOpen || !isAdmin) return null;

	const handlePrint = () => {
		window.print();
	};

	const sheetsCount = Math.ceil(labels.length / 24) || 1;

	const renderCardContent = (label: (typeof labels)[0], isPrint: boolean) => (
		<div
			key={label.id}
			className="label-card-print"
			style={{
				width: isPrint ? '60mm' : '100%',
				height: isPrint ? '30mm' : 'auto',
				minHeight: '30mm',
				maxHeight: isPrint ? '30mm' : 'none',
				border: '1.5px dashed #000000',
				borderRadius: '2px',
				boxSizing: 'border-box',
				padding: isPrint ? '2mm 3mm' : '8px 10px',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				textAlign: 'center',
				backgroundColor: '#ffffff',
				pageBreakInside: 'avoid',
				breakInside: 'avoid',
			}}
		>
			{/* Imię i Nazwisko */}
			<div
				style={{
					fontSize: isPrint ? '13px' : '13px',
					fontWeight: '900',
					textTransform: 'uppercase',
					color: '#000000',
					lineHeight: '1.15',
					letterSpacing: '0.3px',
					wordBreak: 'break-word',
					maxWidth: '100%',
				}}
			>
				{label.studentName}
			</div>

			{/* Nazwa grupy */}
			<div
				style={{
					fontSize: isPrint ? '10px' : '11px',
					fontWeight: '700',
					color: '#222222',
					marginTop: '3px',
					lineHeight: '1.15',
					wordBreak: 'break-word',
					maxWidth: '100%',
				}}
			>
				{label.groupName}
			</div>

			{/* Opcjonalne nazwy projektów */}
			{includeProjects && label.projects.length > 0 && (
				<div
					style={{
						fontSize: isPrint ? '8px' : '9px',
						fontWeight: '500',
						color: '#555555',
						marginTop: '2px',
						fontStyle: 'italic',
						lineHeight: '1.1',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						maxWidth: '100%',
					}}
				>
					{label.projects.join(', ')}
				</div>
			)}
		</div>
	);

	return (
		<>
			{/* STYLE DRUKU - WYPEŁNIAJĄ DOKŁADNIE A4 PORTRAIT */}
			<style>{`
				@media screen {
					#labels-print-portal {
						display: none !important;
					}
				}
				@media print {
					@page {
						size: A4 portrait !important;
						margin: 10mm !important;
					}
					html, body {
						background: #ffffff !important;
						margin: 0 !important;
						padding: 0 !important;
						width: 100% !important;
						height: auto !important;
					}
					/* Ukrywamy całą aplikację i modal, drukujemy tylko portal */
					body > *:not(#labels-print-portal) {
						display: none !important;
					}
					#labels-print-portal {
						display: block !important;
						width: 190mm !important;
						margin: 0 auto !important;
						padding: 0 !important;
						background: #ffffff !important;
					}
					#labels-print-portal * {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
					}
					.labels-grid-print {
						display: grid !important;
						grid-template-columns: 60mm 60mm 60mm !important;
						column-gap: 5mm !important;
						row-gap: 4mm !important;
						width: 190mm !important;
						justify-content: start !important;
						align-content: start !important;
					}
					.label-card-print {
						width: 60mm !important;
						height: 30mm !important;
						min-height: 30mm !important;
						max-height: 30mm !important;
						border: 1.5px dashed #000000 !important;
						box-sizing: border-box !important;
						page-break-inside: avoid !important;
						break-inside: avoid !important;
						background: #ffffff !important;
					}
				}
			`}</style>

			{/* PORTAL DRUKU (DOCZEPIONY DO BODY, AKTYWOWANY W @media print) */}
			{createPortal(
				<div id="labels-print-portal">
					<div className="labels-grid-print">
						{labels.map((label) => renderCardContent(label, true))}
					</div>
				</div>,
				document.body
			)}

			{/* MODAL EKRANOWY */}
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 md:p-6 backdrop-blur-sm">
				<div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl transition-all">
					{/* NAGŁÓWEK MODALU */}
					<div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
								<Scissors size={20} />
							</div>
							<div>
								<h2 className="text-lg font-extrabold text-slate-800">
									Drukuj etykiety do woreczków (A4)
									<span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
										Tylko Administrator
									</span>
								</h2>
								<p className="text-xs text-slate-500">
									Format pionowy A4 (3 kolumny po 6×3 cm, do 24 etykiet na arkusz z przerywaną linią cięcia)
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

					{/* WYBRANE GRUPY DO WYDRUKU (ZAZNACZONE CHECKBOXAMI) */}
					{activeBatches.length > 0 && (
						<div className="border-b border-slate-200 bg-purple-50/50 px-6 py-3">
							<div className="mb-2 flex items-center justify-between">
								<div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
									<LayersFill className="text-purple-600" />
									Wybrane grupy do wydruku na tym arkuszu ({activeBatches.length}):
								</div>
								{activeBatches.length > 1 && (
									<button
										type="button"
										onClick={clearAllSelected}
										className="text-[11px] font-medium text-slate-500 hover:text-red-600 cursor-pointer transition-colors"
									>
										Usuń wszystkie
									</button>
								)}
							</div>

							<div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
								{activeBatches.map((b) => {
									const uniqueKids = new Set(b.printJobs.map((j) => j.studentName)).size;
									return (
										<span
											key={b.id}
											className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-purple-900 shadow-xs"
										>
											<span className="truncate max-w-[220px]">{b.groupName}</span>
											<span className="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-700">
												{uniqueKids} {uniqueKids === 1 ? 'dziecko' : 'dzieci'}
											</span>
											<button
												type="button"
												onClick={() => removeBatch(b.id)}
												className="cursor-pointer text-slate-400 hover:text-red-600 transition-colors ml-0.5"
												title="Usuń tę grupę z arkusza"
											>
												<XLg size={11} />
											</button>
										</span>
									);
								})}
							</div>
						</div>
					)}

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
							<div className="text-right mr-2">
								<div className="text-xs font-bold text-slate-800">
									Łącznie: <span className="text-purple-600 font-extrabold">{labels.length}</span> etykiet
								</div>
								<div className="text-[10px] text-slate-400">
									{sheetsCount} {sheetsCount === 1 ? 'strona A4' : 'strony A4'} (mieści 24 na arkusz)
								</div>
							</div>

							<button
								type="button"
								onClick={onClose}
								className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
							>
								Zamknij
							</button>
							<button
								type="button"
								onClick={handlePrint}
								disabled={labels.length === 0}
								className="cursor-pointer flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-purple-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<PrinterFill size={15} />
								Drukuj na A4 ({labels.length})
							</button>
						</div>
					</div>

					{/* PODGLĄD EKRANOWY ARKUSZA */}
					<div className="flex-1 overflow-y-auto bg-slate-200/70 p-4 md:p-6">
						{labels.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
								<Scissors className="mx-auto mb-3 text-slate-300" size={32} />
								<p className="text-sm font-bold text-slate-600">Brak wybranych grup do wydruku etykiet.</p>
								<p className="text-xs text-slate-400 mt-1">
									Zaznacz checkboxy przy grupach na liście w panelu lub kliknij „Etykiety” przy danej paczce.
								</p>
							</div>
						) : (
							<div className="mx-auto max-w-[210mm] rounded-xl border border-slate-300 bg-white p-6 shadow-xl">
								<div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-400 font-medium">
									<span className="flex items-center gap-1.5">
										<EyeFill size={12} /> Podgląd układu arkusza A4 pionowego (3 równe kolumny, linie przerywane wskazują cięcie gilotyną)
									</span>
									<span className="font-bold text-slate-600">Rozmiar: 60 × 30 mm</span>
								</div>

								{/* SIATKA PODGLĄDU 3 KOLUMNY */}
								<div
									style={{
										display: 'grid',
										gridTemplateColumns: 'repeat(3, 1fr)',
										gap: '12px',
									}}
								>
									{labels.map((label) => renderCardContent(label, false))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
};
