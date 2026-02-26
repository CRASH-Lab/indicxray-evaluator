import axios from "axios";
import { toast } from "sonner";
import { Record, Metric } from "@/types";
import useEvalutationStore from "@/stores/evaluation";
import {
  transformAssignmentToRecords,
  transformAssignedImagesToRecords,
} from "./adapters";

const BASE_URL = import.meta.env.VITE_API_URL || "";

// Get token from localStorage
const getAuthToken = () => localStorage.getItem("authToken");

const instance = axios.create({
  baseURL: BASE_URL.endsWith("/") ? `${BASE_URL}api/` : `${BASE_URL}/api/`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
instance.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Add response interceptor for better error handling
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);

    let message = "An unexpected error occurred.";

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        message = "Authentication expired. Please log in again.";
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userId");
        if (window.location.pathname !== "/") {
          window.location.href = "/";
        }
      } else if (status === 403) {
        message = "You do not have permission to perform this action.";
      } else if (status === 404) {
        // We might want to suppress 404s if they are handled by fallback logic,
        // but for general API failures it's good to know.
        // However, existing logic in use-records.tsx handles 404s for fallback.
        // We can check if the error config explicitly skips global handling?
        // For now, let's show it, but maybe as a warning or just rely on the fallback catching it?
        // If we throw, the catch block runs.
        message = "Resource not found.";
      } else if (status >= 500) {
        message = "Server error. Please try again later.";
      } else if (data && typeof data === "object") {
        if (data.detail) message = data.detail;
        else if (data.message) message = data.message;
      }
    } else if (error.request) {
      message = "No response received from the server.";
    } else {
      message = error.message;
    }

    // specific check to avoid toaster spam if needed, or just show it.
    // We filter out 404s for assignments if we want to support that fallback logic silently?
    // The previous code logged a warning for 404.
    if (error.response?.status !== 404) {
      toast.error(message, {
        description: error.response?.data?.detail || "",
      });
    } else {
      // For 404, we might still want to notify if it's NOT an assignment fetch?
      // Let's keep it simple: Show toast for 404s too unless it's a specific known "safe" 404.
      // But since we know use-records has a fallback, maybe we should be careful.
      // The prompt asked for "any type of error".
      // Let's show it.
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

// Cache for metrics and models data
let metricsCache: any[] | null = null;
let metricsPromise: Promise<any[]> | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastMetricsFetch = 0;

// Function to get metrics with caching
async function getCachedMetrics() {
  const now = Date.now();

  // Return existing cache if valid
  if (metricsCache && now - lastMetricsFetch < CACHE_DURATION) {
    return metricsCache;
  }

  // Return existing promise if fetch is in flight
  if (metricsPromise) {
    return metricsPromise;
  }

  // Fetch new metrics
  metricsPromise = (async () => {
    try {
      const response = await instance.get("metrics/");
      metricsCache = response.data.metrics || [];
      lastMetricsFetch = Date.now();
      return metricsCache || [];
    } catch (error) {
      console.error("Failed to load metrics", error);
      metricsCache = null; // Clear cache on error
      throw error;
    } finally {
      metricsPromise = null; // Clear promise
    }
  })();

  return metricsPromise;
}

// Function to test the API connectivity
async function testBackendConnection(): Promise<boolean> {
  try {
    await instance.get("metrics/"); // Check metrics endpoint
    return true;
  } catch (error) {
    console.error("❌ Backend connection failed:", error);
    return false;
  }
}

// Login function
async function login(email: string, password?: string): Promise<any> {
  try {
    const payload: any = { email };
    if (password) {
      payload.password = password;
    }
    const response = await instance.post("auth/login/", payload);
    return response.data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CaseWithDetails {
  id: string;
  image_id: string;
  image_url: string; // Ground truth URL
  status: string;
  completed_evaluations: number;
  total_evaluations: number;
  last_updated: string;
  // Additional fields from assignment details
  evaluation_set_id?: string;
  study_id?: string;
}

interface CasesResponse {
  cases: CaseWithDetails[];
  total_cases: number;
  pending_cases: number;
  in_progress_cases: number;
  completed_cases: number;
}

// Get user details
async function getUserDetails(userId?: string): Promise<UserDetails> {
  try {
    // Determine strict user ID checks - if not provided, rely on token (auth/me)
    const endpoint = userId ? `users/${userId}/` : "auth/me/";
    const response = await instance.get(endpoint);
    return response.data;
  } catch (error) {
    console.error("Error fetching user details:", error);
    throw error;
  }
}

// Check if a user is a supervisor
async function isSupervisor(userId: string): Promise<boolean> {
  try {
    const user = await getUserDetails(userId);
    return user.role === "supervisor";
  } catch (error) {
    console.error("Error checking if user is supervisor:", error);
    return false;
  }
}

// Get all assignments for current user
async function getEvaluatorAssignments(): Promise<CasesResponse> {
  try {
    const response = await instance.get("evaluations/my-assignments/");
    const data = response.data;

    // Transform assignments to cases format Expected by UI
    const cases: CaseWithDetails[] = [];

    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    if (data.assignments && Array.isArray(data.assignments)) {
      data.assignments.forEach((assignment: any) => {
        // For now, mapping assignment to a single "case" entry in the list
        // Ideally we might want to expand to images if UI expects image list
        // But let's map assignment -> case for now

        // The backend returns an assignment which contains progress
        // We need to fetch details to get individual images if that's what UI expects
        // Or we can treat the assignment as the container.

        // Based on DoctorCases.tsx, it iterates over "cases".
        // Let's assume user wants to see individual assignments.

        const status = assignment.status;

        if (status === "completed") completed++;
        else if (status === "in_progress") inProgress++;
        else pending++;

        total++;

        cases.push({
          id: assignment.id,
          image_id: assignment.evaluation_set.study_id, // Using Study ID as display name
          image_url: "", // Placeholder
          status: status,
          completed_evaluations: assignment.progress.completed_evaluations,
          total_evaluations: assignment.progress.total_evaluations,
          last_updated: assignment.last_activity_at || assignment.assigned_at,
          evaluation_set_id: assignment.evaluation_set.id,
          study_id: assignment.evaluation_set.study_id,
        });
      });
    }

    return {
      cases,
      total_cases: total,
      pending_cases: pending,
      in_progress_cases: inProgress,
      completed_cases: completed,
    };
  } catch (error) {
    console.error("Error fetching assignments:", error);
    throw error;
  }
}

async function getAssignmentDetails(
  assignmentId: string,
): Promise<{ data: Record[] }> {
  try {
    const [response, metrics] = await Promise.all([
      instance.get(`evaluations/assignments/${assignmentId}/`),
      getCachedMetrics(), // Ensure we have metrics
    ]);

    const data = response.data;

    // Transform to Record[] format expected by UI
    return { data: transformAssignmentToRecords(assignmentId, data, metrics) };
  } catch (error: any) {
    // Suppress 404 logging as it's a valid case for fallback
    if (error.response && error.response.status === 404) {
      console.warn(
        "Assignment not found (404), likely an Image ID. Fallback will handle this.",
      );
    } else {
      console.error("Error fetching assignment details:", error);
    }
    throw error;
  }
}

// Get all metrics defined in the system
async function getMetrics(): Promise<any[]> {
  try {
    const response = await instance.get("metrics/");
    return response.data.metrics || [];
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return [];
  }
}

// Get unified list of all assigned images
async function getAllAssignedImages(): Promise<{ data: Record[] }> {
  try {
    const [response, metrics] = await Promise.all([
      instance.get("evaluations/assigned-images/"),
      getCachedMetrics(),
    ]);

    const data = response.data; // { images: [], total_count }

    return { data: transformAssignedImagesToRecords(data, metrics) };
  } catch (error) {
    console.error("Error fetching all assigned images:", error);
    throw error;
  }
}

// Function to update evaluations (bulk save)
async function saveEvaluations(data: {
  assignmentId: string;
  groundTruthImageId: string; // We might need to lookup internal ID
  modelOutputId: string;
  evaluations: { metric_name: string; score: number }[];
}) {
  try {
    const payload = {
      assignment_id: data.assignmentId,
      ground_truth_image_id: data.groundTruthImageId,
      model_output_id: data.modelOutputId,
      evaluations: data.evaluations,
    };

    const response = await instance.post("evaluations/bulk/", payload);

    return response.data;
  } catch (error: any) {
    console.error("Error saving evaluations:", error);
    if (error.response && error.response.data) {
      console.error(
        "Detailed API Error:",
        JSON.stringify(error.response.data, null, 2),
      );
    }
    throw error;
  }
}

// Function to start assignment
async function startAssignment(assignmentId: string) {
  try {
    await instance.post(`evaluations/assignments/${assignmentId}/start/`);
  } catch (e) {
    console.error("Error starting assignment", e);
  }
}

// Function to complete assignment
async function completeAssignment(assignmentId: string) {
  try {
    const response = await instance.post(
      `evaluations/assignments/${assignmentId}/complete/`,
    );
    return response.data;
  } catch (e) {
    console.error("Error completing assignment", e);
    throw e;
  }
}

// Compatibility exports
// Some functions might be deprecated or need adapting
const getEvaluatorCasesWithDetails = getEvaluatorAssignments; // Map to new function for now

// Supervisor functions
async function getAllCases() {
  try {
    // For now, return empty list or mock data if endpoint doesn't exist yet
    // backend endpoint might be /api/admin/evaluation-sets/ or similar
    // Using a safe fallback for now
    return [];
  } catch (error) {
    console.error("Error fetching all cases:", error);
    return [];
  }
}

async function getAllEvaluators() {
  try {
    const response = await instance.get("admin/users/");
    return response.data;
  } catch (error) {
    console.error("Error fetching evaluators:", error);
    return [];
  }
}

async function getAllEvaluations() {
  try {
    // This might be a heavy call, ideally should be paginated or filtered
    // For now, returning empty to prevent crash if endpoint not ready
    return [];
  } catch (error) {
    console.error("Error fetching all evaluations:", error);
    return [];
  }
}

async function getEvaluatorCases(evaluatorId: string) {
  try {
    const response = await instance.get(`users/${evaluatorId}/assignments/`);
    const data = response.data;

    // Transform or return straight if format matches
    // The backend returns { assignments: [...] }
    // UI might expect just the array or a specific structure.
    // Based on previous code in getEvaluatorAssignments, we need to adapt it?
    // Let's look at what getEvaluatorAssignments returns -> CasesResponse { cases: [] ... }

    // The previous getEvaluatorAssignments (current user) transforms manualy.
    // We should probably reuse that transformation logic or similar.

    const cases: any[] = [];
    if (data.assignments && Array.isArray(data.assignments)) {
      data.assignments.forEach((assignment: any) => {
        cases.push({
          id: assignment.id,
          image_id: assignment.evaluation_set.study_id,
          image_url: "",
          status: assignment.status,
          completed_evaluations: assignment.progress.completed_evaluations,
          total_evaluations: assignment.progress.total_evaluations,
          last_updated: assignment.last_activity_at || assignment.assigned_at,
          evaluation_set_id: assignment.evaluation_set.id,
          study_id: assignment.evaluation_set.study_id,
        });
      });
    }
    return cases;
  } catch (error) {
    console.error("Error fetching evaluator cases:", error);
    return [];
  }
}

// Admin User Management
async function adminCreateUser(userData: any) {
  try {
    const response = await instance.post("admin/users/", userData);
    return response.data;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

async function adminUpdateUser(userId: string, userData: any) {
  try {
    const response = await instance.patch(`admin/users/${userId}/`, userData);
    return response.data;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

async function adminDeleteUser(userId: string) {
  try {
    const response = await instance.delete(`admin/users/${userId}/`);
    return response.data;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

async function adminGetAssignments() {
  try {
    const response = await instance.get("admin/assignments/");
    return response.data.assignments || [];
  } catch (error) {
    console.error("Error fetching admin assignments:", error);
    return [];
  }
}

async function adminGetEvaluations() {
  try {
    const response = await instance.get("admin/evaluations/");
    return response.data;
  } catch (error) {
    console.error("Error fetching admin evaluations:", error);
    return [];
  }
}

// Stage 2 Functions
async function getStage2Images() {
  try {
    const response = await instance.get("stage2/images/");
    return response.data;
  } catch (error) {
    console.error("Error fetching Stage 2 images:", error);
    throw error;
  }
}

async function saveStage2Evaluation(imageId: string, score: number) {
  try {
    const response = await instance.post("stage2/evaluations/", {
      image_id: imageId,
      score: score,
    });
    return response.data;
  } catch (error) {
    console.error("Error saving Stage 2 evaluation:", error);
    throw error;
  }
}




async function adminGetStage2Stats() {
  try {
      const response = await instance.get("admin/stage2/stats/");
      return response.data;
  } catch (error) {
      console.error("Error fetching Stage 2 stats:", error);
      return { stats: [], total_images: 0 };
  }
}
const refreshImageUrl = async (type: 'image' | 'model' | 'stage2' | 's3_record', id: string) => {
  try {
    const response = await instance.post('/evaluations/refresh-url/', { type, id });
    return response.data;
  } catch (error) {
    console.error('refreshImageUrl Error:', error);
    throw error;
  }
};

export {
  login,
  getEvaluatorAssignments,
  getEvaluatorCasesWithDetails,
  getAssignmentDetails,
  testBackendConnection,
  getUserDetails,
  isSupervisor,
  getMetrics,
  saveEvaluations,
  startAssignment,
  completeAssignment,
  getAllCases,
  getAllEvaluators,
  getAllEvaluations,
  getEvaluatorCases,
  getAllAssignedImages,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetAssignments,
  adminGetEvaluations,
  getStage2Images,
  saveStage2Evaluation,
  adminGetStage2Stats,
  refreshImageUrl
};
