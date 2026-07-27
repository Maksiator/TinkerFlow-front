import React, { useMemo } from 'react';
import { ListCheck, XCircleFill } from 'react-bootstrap-icons';
import { ProjectState, type Project } from '../api/projectService';
import { type Student } from '../api/studentService';

interface MatrixSummaryPanelProps {
	matrixState: Record<string, ProjectState>;
	students: Student[];
	projects: Project[];
	onClose: () => void;
}

export const MatrixSummaryPanel: React.FC<MatrixSummaryPanelProps> = ({ matrixState, students, projects, onClose }) => {
	const { activeTasks } = useMemo(() => {
		const active: { matrixKey: string; studentName: string; projectName: string; status: ProjectState }[] = [];

		Object.entries(matrixState).forEach(([key, status]) => {
			const [studentId, matrixProjectId] = key.split('_');
			const student = students.find((s) => s.id === studentId);
			const project = projects.find((p) => p.id === matrixProjectId);

			if (student && project) {
				const studentName = `${student.firstName} ${student.lastName}`;

				if (status === ProjectState.Scheduled || status === ProjectState.InProgress) {
					active.push({ matrixKey: key, studentName, projectName: project.name, status });
				}
			}
		});

		// Sortowanie alfabetyczne po nazwisku/imieniu dla lepszego UX
		active.sort((a, b) => a.studentName.localeCompare(b.studentName));

		return { activeTasks: active };
	}, [matrixState, students, projects]);

	return (
		<div className="absolute top-0 right-0 bottom-0 z-40 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-[-10px_0_25px_rgba(0,0,0,0.1)] transition-all duration-300 sm:w-80">
			<div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
				<h3 className="font-bold text-slate-800">Podsumowanie zajęć</h3>
				<button onClick={onClose} className="cursor-pointer text-slate-400 transition-colors hover:text-slate-700">
					<XCircleFill size={22} />
				</button>
			</div>

			<div className="scrollbar-thin flex-1 overflow-y-auto">
				<div className="p-4">
					{/* SEKCJA: W TRAKCIE PRACY */}
					<div className="mb-6">
						<div className="mb-3 flex items-center gap-2 text-blue-700">
							<ListCheck />
							<h4 className="font-bold">W trakcie pracy ({activeTasks.length})</h4>
						</div>

						{activeTasks.length === 0 ? (
							<p className="text-sm text-slate-400 italic">Nikt nie jest w trakcie projektowania.</p>
						) : (
							<ul className="flex flex-col gap-2">
								{activeTasks.map((item) => (
									<li key={item.matrixKey} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
										<div className="font-bold text-slate-800">{item.studentName}</div>
										<div className="mt-1 flex items-center justify-between text-slate-600">
											<span className="truncate pr-2">{item.projectName}</span>
											<span
												className={`rounded px-2 py-0.5 font-mono text-xs font-bold whitespace-nowrap ${
													item.status === ProjectState.Scheduled
														? 'bg-blue-100 text-blue-700'
														: 'bg-yellow-100 text-yellow-800'
												}`}
											>
												{item.status === ProjectState.Scheduled ? 'Plan' : 'W trakcie'}
											</span>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
