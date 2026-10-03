import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

const TOKEN_KEY = "voip_auth_token";

/**
 * Storing the JWT in localStorage is fine for this development stage
 * (per the Stage 2 spec). It is readable by any script on the page,
 * so this is not the final production approach — that's a later-stage
 * concern once the app has real users.
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Attach the JWT (if we have one) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Stage 1 sanity check: confirms the React app can reach the Express server.
 */
export async function checkHealth() {
  const { data } = await api.get("/health");
  return data;
}

/** @returns {Promise<{ token: string, user: { id: number, username: string, email: string } }>} */
export async function registerUser({ username, email, password }) {
  const { data } = await api.post("/auth/register", {
    username,
    email,
    password,
  });
  return data;
}

/** @returns {Promise<{ token: string, user: { id: number, username: string, email: string } }>} */
export async function loginUser({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

/** @returns {Promise<{ id: number, username: string, email: string }>} */
export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data.user;
}

export async function logoutUser() {
  // Best-effort: even if this network call fails, the caller still
  // clears the local token, since JWT logout is a client-side action.
  await api.post("/auth/logout").catch(() => {});
}

/** @returns {Promise<{ contacts: Array<{ id: number, username: string, email: string, isOnline: boolean }> }>} */
export async function fetchContacts() {
  const { data } = await api.get("/contacts");
  return data.contacts;
}

/** @returns {Promise<{ message: string, contact: { id: number, username: string, email: string, isOnline: boolean } }>} */
export async function addContactApi({ username, contactId }) {
  const { data } = await api.post("/contacts", { username, contactId });
  return data;
}

/** @returns {Promise<{ message: string }>} */
export async function removeContactApi(contactId) {
  const { data } = await api.delete(`/contacts/${contactId}`);
  return data;
}

/** @returns {Promise<Array<{ id: number, username: string, email: string, isOnline: boolean }>>} */
export async function searchUsersApi(query) {
  const { data } = await api.get(
    `/users/search?q=${encodeURIComponent(query)}`,
  );
  return data.users;
}
