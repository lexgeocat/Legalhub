import { nombrePersona } from '../domain/personas';
import type { DbPuerto, Fila } from './puertos/db';

const t = (v: unknown) => (v == null ? '' : String(v));

export interface ExpedienteResumen { id: string; codigo: string; materia: string; estado: string; juzgado: string; clienteNombre: string }
export interface PersonaResumen { id: string; tipo: string; nombre: string; ci: string }
export interface ParteResumen { id: string; rol: string; nombre: string; domicilioProcesal: string }
export interface VersionResumen { id: string; nro: number; origen: string; creadoEn: string; ruta: string; sha256: string }
export interface DocumentoResumen { id: string; titulo: string; estado: string; versiones: VersionResumen[] }
export interface ModeloResumen { id: string; nombre: string; materia: string; versionId: string; version: number; schemaJson: string }

export class Consultas {
    constructor(private readonly db: DbPuerto) { }

    async listarExpedientes(): Promise<ExpedienteResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT e.id, e.codigo, e.materia, e.estado, e.juzgado, p.tipo, p.nombres, p.apellido_paterno,
              p.apellido_materno, p.apellido_casada, p.razon_social
       FROM expediente e LEFT JOIN persona p ON p.id = e.cliente_id
       WHERE e.deleted_at IS NULL ORDER BY e.created_at DESC`,
        );
        return filas.map((f) => ({
            id: t(f.id), codigo: t(f.codigo), materia: t(f.materia), estado: t(f.estado), juzgado: t(f.juzgado),
            clienteNombre: nombrePersona(f),
        }));
    }

    async obtenerExpediente(id: string): Promise<ExpedienteResumen | null> {
        return (await this.listarExpedientes()).find((e) => e.id === id) ?? null;
    }

    async listarPersonas(): Promise<PersonaResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT id, tipo, nombres, apellido_paterno, apellido_materno, apellido_casada, razon_social,
              ci_numero, ci_complemento, ci_expedido
       FROM persona WHERE deleted_at IS NULL
       ORDER BY COALESCE(razon_social, apellido_paterno, nombres)`,
        );
        return filas.map((f) => ({
            id: t(f.id), tipo: t(f.tipo), nombre: nombrePersona(f),
            ci: [t(f.ci_numero) && `${t(f.ci_numero)}${t(f.ci_complemento) ? `-${t(f.ci_complemento)}` : ''}`, t(f.ci_expedido)].filter(Boolean).join(' '),
        }));
    }

    async listarPartes(expedienteId: string): Promise<ParteResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT ep.id AS parte_id, ep.rol, ep.domicilio_procesal, p.tipo, p.nombres, p.apellido_paterno,
              p.apellido_materno, p.apellido_casada, p.razon_social
       FROM expediente_parte ep JOIN persona p ON p.id = ep.persona_id
       WHERE ep.expediente_id = ?1 ORDER BY ep.rol, ep.orden`,
            [expedienteId],
        );
        return filas.map((f) => ({ id: t(f.parte_id), rol: t(f.rol), nombre: nombrePersona(f), domicilioProcesal: t(f.domicilio_procesal) }));
    }

    async listarDocumentos(expedienteId: string): Promise<DocumentoResumen[]> {
        const docs = await this.db.consultar<Fila>(
            'SELECT id, titulo, estado FROM documento WHERE expediente_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC',
            [expedienteId],
        );
        const salida: DocumentoResumen[] = [];
        for (const d of docs) {
            const vs = await this.db.consultar<Fila>(
                'SELECT id, nro, origen, created_at, ruta, sha256 FROM documento_version WHERE documento_id = ?1 ORDER BY nro DESC',
                [d.id],
            );
            salida.push({
                id: t(d.id), titulo: t(d.titulo), estado: t(d.estado),
                versiones: vs.map((v) => ({ id: t(v.id), nro: Number(v.nro), origen: t(v.origen), creadoEn: t(v.created_at), ruta: t(v.ruta), sha256: t(v.sha256) })),
            });
        }
        return salida;
    }

    async listarModelos(): Promise<ModeloResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT m.id, m.nombre, m.materia, v.id AS version_id, v.version, v.schema_json
       FROM modelo m JOIN modelo_version v ON v.modelo_id = m.id
       WHERE m.activo = 1 AND v.version = (SELECT MAX(version) FROM modelo_version WHERE modelo_id = m.id)
       ORDER BY m.nombre`,
        );
        return filas.map((f) => ({
            id: t(f.id), nombre: t(f.nombre), materia: t(f.materia), versionId: t(f.version_id),
            version: Number(f.version), schemaJson: t(f.schema_json),
        }));
    }
}