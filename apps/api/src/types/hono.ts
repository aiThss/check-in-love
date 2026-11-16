import type { AppConfig, WorkerEnv } from '../config/env';

export interface AuthUserContext {
  id: string;
  coupleId: string | null;
  role: 'user' | 'admin';
}

export interface AuthAdminContext {
  email: string;
  role: 'admin';
}

export interface HonoAppEnv {
  Bindings: WorkerEnv;
  Variables: {
    config: AppConfig;
    user?: AuthUserContext;
    admin?: AuthAdminContext;
  };
}
