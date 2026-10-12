export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  locale: string;
  timezone: string;
  status: "active" | "suspended";
  email_verified?: boolean;
  current_store_id: number | null;
  roles: string[];
  permissions: string[];
  created_at: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}
