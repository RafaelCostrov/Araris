export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  auth_provider: string;
}

export interface Organization {
  id: string;
  business_name: string;
  trade_name: string;
  cnpj: string;
  initial_balance: number;
}

export interface Membership {
  id: string;
  organization: Organization;
  role: string;
  status: string;
}

export interface MeResponse {
  user: User;
  memberships: Membership[];
}

export interface AuthSession {
  user: User;
  organization: Organization;
  role: string;
}
