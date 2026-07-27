import { GeoAltFill, PeopleFill } from 'react-bootstrap-icons';
import React from 'react';

interface GroupCardProps {
	id: string;
	name: string;
	location: string;
	studentCount?: number; // Opcjonalne (tylko dla widoku Grup)
	isSelected?: boolean; // Opcjonalne (tylko dla Matryc)
	onSelect?: (id: string) => void; // Opcjonalne (tylko dla Matryc)
	actions?: React.ReactNode; // Opcjonalne przyciski na dole karty
}

export function GroupCard({ id, name, location, studentCount, isSelected = false, onSelect, actions }: GroupCardProps) {
	const isSelectable = !!onSelect;

	return (
		<div
			onClick={() => isSelectable && onSelect(id)}
			className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 ${
				isSelectable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'hover:shadow-md'
			} ${
				isSelected ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-200'
			}`}
		>
			<div className="mb-4 flex-1">
				<h3 className={`mb-3 text-lg font-bold transition-colors ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
					{name}
				</h3>

				<div className="flex flex-col gap-2 text-sm font-medium text-slate-500">
					<div className="flex items-center gap-2">
						<GeoAltFill className="shrink-0 text-orange-500" />
						<span className="truncate">{location}</span>
					</div>

					{studentCount !== undefined && (
						<div className="flex items-center gap-2">
							<PeopleFill className="shrink-0 text-blue-500" />
							<span>Uczniowie: {studentCount}</span>
						</div>
					)}
				</div>
			</div>

			{/* Jeśli przekazaliśmy przyciski (np. Edytuj/Usuń), rysujemy linię i je wyświetlamy */}
			{actions && <div className="flex gap-2 border-t border-slate-100 pt-4">{actions}</div>}
		</div>
	);
}
