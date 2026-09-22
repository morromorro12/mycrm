import type {
  Client,
  ClientFull,
  ClientService,
  CurrencyCode,
  Payment,
  Prospect,
} from "../types";

export type ProspectInput = Omit<Prospect, "id" | "converted_client_id" | "archived">;
export type ClientInput = Omit<Client, "id" | "active" | "archived">;
export type ServiceInput = Omit<ClientService, "id" | "client_id">;

/**
 * Una sola interfaz de datos, dos implementaciones:
 *   · supabase-repo → la base real
 *   · demo-repo     → datos de ejemplo en memoria, mientras no haya claves
 * Las vistas y las server actions no saben cuál está activa.
 */
export interface Repo {
  readonly mode: "supabase" | "demo";

  listProspects(): Promise<Prospect[]>;
  getProspect(id: string): Promise<Prospect | null>;
  createProspect(input: ProspectInput): Promise<Prospect>;
  updateProspect(id: string, patch: Partial<ProspectInput>): Promise<void>;
  setProspectStage(id: string, stage: Prospect["stage"]): Promise<void>;
  /** Archivar / desarchivar. No borra nada. */
  setProspectArchived(id: string, archived: boolean): Promise<void>;
  /** Borrado definitivo. Sólo se llega desde el archivo. */
  deleteProspect(id: string): Promise<void>;
  linkProspectToClient(prospectId: string, clientId: string): Promise<void>;

  listClients(): Promise<ClientFull[]>;
  /** Lo archivado, para la pantalla de archivo. */
  listArchived(): Promise<{ prospects: Prospect[]; clients: ClientFull[] }>;
  getClient(id: string): Promise<ClientFull | null>;
  createClient(input: ClientInput, services: ServiceInput[]): Promise<Client>;
  updateClient(id: string, patch: Partial<Client>): Promise<void>;
  /** Archivar / desarchivar. No borra nada. */
  setClientArchived(id: string, archived: boolean): Promise<void>;
  /** Borrado definitivo: arrastra servicios y pagos. Sólo desde el archivo. */
  deleteClient(id: string): Promise<void>;

  addService(clientId: string, input: ServiceInput): Promise<void>;
  updateService(id: string, patch: Partial<ServiceInput>): Promise<void>;
  deleteService(id: string): Promise<void>;

  recordPayment(args: {
    clientId: string;
    serviceId: string;
    period: string;
    amount: number;
    currency: CurrencyCode;
    paidAt: string;
  }): Promise<void>;
  deletePayment(id: string): Promise<void>;
  listPayments(clientId: string): Promise<Payment[]>;
}
