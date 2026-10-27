import type { StoreRole } from '../modules/access/permissions';
import type { StoreRow } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
        role: string;
      };
      storeAccess?: {
        store: StoreRow;
        role: StoreRole;
        isOwner: boolean;
      };
    }
  }
}

export {};
