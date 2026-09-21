import axios from 'axios';
import { apiClient } from './client';

// ==========================================
// 1. ENUMY (Zgodne z C#)
// ==========================================

export const PrintBatchState = {
	Pending: 0,
	Printing: 1,
	ReadyForCollection: 2,
	Completed: 3,
	NoPrints: 4,
} as const;
export type PrintBatchState = (typeof PrintBatchState)[keyof typeof PrintBatchState];

export const PrintJobsStates = {
	Pending: 0,
	Printing: 1,
	Printed: 2,
	Failed: 3,
} as const;
export type PrintJobsStates = (typeof PrintJobsStates)[keyof typeof PrintJobsStates];

// ==========================================
// 2. INTERFEJSY / DTOs (Odzwierciedlenie C#)
// ==========================================

export interface PrintJobRequest {
	studentId: string;
	projectId?: string | null;
	customName?: string | null;
}

export interface CreatePrintBatchRequest {
	groupId: string;
	lessonDate: string; // ISO String np. "2026-10-15T00:00:00Z"
	notes?: string | null;
	projectsToPrint: PrintJobRequest[];
}

export interface UpdatePrintBatchRequest {
	lessonDate: string;
	notes?: string | null;
	projectsToPrint: PrintJobRequest[];
}

export interface ReportNoPrintsRequest {
	groupId: string;
	lessonDate: string;
	reason?: string;
	additionalNotes?: string | null;
}

export interface PrintJobResponse {
	id: string;
	studentId: string;
	studentName: string;
	studentProjectId: string | null;
	projectName: string;
	status: PrintJobsStates;
}

export interface PrintBatchResponse {
	id: string;
	groupId: string;
	groupName: string;
	branchId: string;
	branchName: string;
	lessonDate: string;
	deadline: string;
	notes: string | null;
	status: PrintBatchState;
	printJobs: PrintJobResponse[];
	createdAt: string;
	assignedPrinterId?: string | null;
	assignedPrinterName?: string | null;
	classDayOfWeek?: number | null;
	printerNotes?: string | null;
}

export interface ConfirmDeliveryRequest {
	confirmedStudentProjectIds: string[];
}

// ==========================================
// 3. LOGIKA SERWISU
// ==========================================

// Kontroler w C# ma [Route("api/[controller]")], więc endpoint to /PrintBatches
// apiClient ma zdefiniowane baseURL, które pewnie zawiera '/api'
const BASE_URL = '/printbatches';

/**
 * Pomocnicza funkcja do wyciągania przyjaznego komunikatu o błędzie z backendu (pod React Hot Toast)
 */
const extractErrorMessage = (error: unknown, defaultMessage: string): string => {
	if (axios.isAxiosError(error) && error.response) {
		const serverMessage = error.response.data?.message;
		if (typeof serverMessage === 'string') return serverMessage;

		if (error.response.data?.errors) {
			const firstErrorKey = Object.keys(error.response.data.errors)[0];
			return error.response.data.errors[firstErrorKey][0];
		}
	}
	return defaultMessage;
};

export const printBatchService = {
	// ----------------------------------------------------
	// DLA TRENERA
	// ----------------------------------------------------

	sendToFarm: async (data: CreatePrintBatchRequest) => {
		try {
			const response = await apiClient.post<{ message: string; batchId: string; deadline: string }>(
				'/printbatches/send-to-farm', // Wpisane z palca - zgodnie z Twoją konwencją
				data,
			);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas wysyłania paczki do drukarza.'));
		}
	},

	reportNoPrints: async (data: ReportNoPrintsRequest) => {
		try {
			const response = await apiClient.post<{ message: string; batchId: string }>(
				'/printbatches/report-no-prints',
				data,
			);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas zgłaszania braku wydruków.'));
		}
	},

	updateBatch: async (batchId: string, data: UpdatePrintBatchRequest) => {
		try {
			const response = await apiClient.put<{ message: string; batchId: string; deadline: string }>(
				`${BASE_URL}/${batchId}`,
				data,
			);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Nie udało się zaktualizować zawartości paczki.'));
		}
	},

	getReadyBatchForGroup: async (groupId: string) => {
		try {
			const response = await apiClient.get<PrintBatchResponse | null>(`${BASE_URL}/group/${groupId}/ready`);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Nie udało się pobrać gotowych paczek dla tej grupy.'));
		}
	},

	confirmDelivery: async (batchId: string, data: ConfirmDeliveryRequest) => {
		try {
			const response = await apiClient.post<{ message: string }>(`${BASE_URL}/${batchId}/delivery-confirm`, data);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas potwierdzania odbioru paczki.'));
		}
	},

	// ----------------------------------------------------
	// DLA DRUKARZA
	// ----------------------------------------------------

	getBatchesForFarm: async (statusFilter?: PrintBatchState, includeCompleted?: boolean) => {
		try {
			const params: any = {};
			if (statusFilter !== undefined) params.statusFilter = statusFilter;
			if (includeCompleted !== undefined) params.includeCompleted = includeCompleted;
			const response = await apiClient.get<PrintBatchResponse[]>('/printbatches/farm', { params });
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Nie udało się załadować listy zleceń druku.'));
		}
	},

	updateBatchStatus: async (batchId: string, status: PrintBatchState, printerNotes?: string | null) => {
		try {
			const payload: { status: PrintBatchState; printerNotes?: string | null } = { status };
			if (printerNotes !== undefined) payload.printerNotes = printerNotes;
			const response = await apiClient.patch<{ message: string; newStatus: PrintBatchState; printerNotes?: string | null }>(
				`${BASE_URL}/${batchId}/status`,
				payload,
			);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas zmiany statusu paczki.'));
		}
	},

	updatePrinterNotes: async (batchId: string, printerNotes: string | null) => {
		try {
			const response = await apiClient.patch<{ message: string; printerNotes: string | null }>(
				`${BASE_URL}/${batchId}/printer-notes`,
				{ printerNotes },
			);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas zapisywania notatki dla trenera.'));
		}
	},

	updateJobStatus: async (jobId: string, status: PrintJobsStates) => {
		try {
			// Zwróć uwagę na ścieżkę w C#: [HttpPatch("~/api/printjobs/{jobId:guid}/status")]
			// Używamy /printjobs bezpośrednio, a nie /printbatches
			const response = await apiClient.patch<{
				message: string;
				newStatus: PrintJobsStates;
				batchStatus?: PrintBatchState;
				batchId?: string;
			}>(`/printjobs/${jobId}/status`, { status });
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas zmiany statusu pojedynczego wydruku.'));
		}
	},
	deleteBatch: async (batchId: string) => {
		try {
			const response = await apiClient.delete<{ message: string }>(`/printbatches/${batchId}`);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Wystąpił błąd podczas usuwania paczki.'));
		}
	},
	getBatchHistoryForGroup: async (groupId: string) => {
		try {
			const response = await apiClient.get<PrintBatchResponse[]>(`/printbatches/group/${groupId}/history`);
			return response.data;
		} catch (error) {
			throw new Error(extractErrorMessage(error, 'Nie udało się pobrać historii paczek dla tej grupy.'));
		}
	},
};
