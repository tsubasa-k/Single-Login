
export interface User {
  username: string;
}

export interface AuthContextType {
  currentUser: User | null;
  login: (username: string) => void;
  logout: () => void;
  isLoading: boolean;
}
