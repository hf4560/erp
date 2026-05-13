import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'engineer' | 'cost_engineer' | 'manager' | 'admin';
      };
    }
  }
}

export {};
