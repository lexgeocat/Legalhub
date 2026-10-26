import { nombrePersona } from '../domain/personas/personas';
import type { DatosPersona } from './casosDeUso/crearPersona';
import type { DbPuerto, Fila } from './puertos/db';

const t = (v: unknown) => (v == null ? '' : String(v));

function datosCaso(v: unknown): Record<string, string> {
    try {
        const o: unknown = JSON.parse(t(v) || '{}');
        if (typeof o !== 'object' || o === null || Array.isArray(o)) return {};
        return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, String(x ?? '')]));
    } catch {
        return {};
    }
}

/** Datos propios de una parte: viven en datos_override_json → { "datos": { clave: valor } }. */
function datosParte(v: unknown): Record<string, string> {
    try {
        const o: unknown = JSON.parse(t(v) || '{}');
        const d = typeof o === 'object' && o !== null ? (o as Record<string, unknown>).datos : null;
        if (typeof d !== 'object' || d === null || Array.isArray(d)) return {};
        return Object.fromEntries(Object.entries(d).map(([k, x]) => [k, String(x ?? '')]));
    } catch {
        return {};
    }
}

export interface ExpedienteResumen {
    id: string; codigo: string; tipo: string; materia: string; referencia: string; estado: string;
    juzgado: string; nroCausa: string; clienteId: string; clienteNombre: string;
    /** Modelo con el que se trabaja el expediente ('' = aún no elegido). */
    modeloId: string;
    datos: Record<string, string>; nPartes: number; nDocumentos: number; creadoEn: string;
}
export interface PersonaResumen { id: string; tipo: string; nombre: string; ci: string; nit: string; telefono: string }
export interface ParteResumen { id: string; personaId: string; rol: string; orden: number; nombre: string; domicilioProcesal: string; datos: Record<string, string> }
export interface VersionResumen { id: string; nro: number; origen: string; creadoEn: string; ruta: string; sha256: string }
export interface DocumentoResumen { id: string; titulo: string; estado: string; creadoEn: string; versiones: VersionResumen[] }
export interface ModeloResumen {
    id: string; nombre: string; materia: string; categoria: string; descripcion: string; activo: boolean;
    versionId: string; version: number; editable: boolean; schemaJson: string; numCampos: number; actualizadoEn: string;
}

export interface VersionModeloResumen { id: string; version: number; editable: boolean; notas: string; creadoEn: string }
export interface PersonaDetalle extends PersonaResumen {
    correo: string;
    /** «C.I. 1234567-1A LP» / «NIT 123…» ('' si no tiene). */
    documento: string;
    /** Clave para detectar fichas repetidas ('' si no tiene documento). */
    claveDoc: string;
    /** En cuántos expedientes vigentes es el cliente / una parte. */
    nCliente: number;
    nPartes: number;
}
export interface VinculoPersona { expedienteId: string; codigo: string; materia: string; estado: string; tipo: string; rol: string }
const SQL_EXPEDIENTE = `
    SELECT e.id, e.codigo, e.tipo, e.materia, e.referencia, e.estado, e.juzgado, e.nro_causa, e.cliente_id,
         e.modelo_id, e.datos_json, e.created_at,
         p.tipo AS p_tipo, p.nombres, p.apellido_paterno, p.apellido_materno, p.apellido_casada, p.razon_social,
         (SELECT COUNT(*) FROM expediente_parte ep WHERE ep.expediente_id = e.id) AS n_partes,
         (SELECT COUNT(*) FROM documento d WHERE d.expediente_id = e.id AND d.deleted_at IS NULL) AS n_documentos
  FROM expediente e LEFT JOIN persona p ON p.id = e.cliente_id
  WHERE e.deleted_at IS NULL`;

function mapearExpediente(f: Fila): ExpedienteResumen {
    return {
        id: t(f.id), codigo: t(f.codigo), tipo: t(f.tipo), materia: t(f.materia), referencia: t(f.referencia),
        estado: t(f.estado), juzgado: t(f.juzgado), nroCausa: t(f.nro_causa), clienteId: t(f.cliente_id),
        clienteNombre: nombrePersona({ ...f, tipo: f.p_tipo }),
        modeloId: t(f.modelo_id),
        datos: datosCaso(f.datos_json), nPartes: Number(f.n_partes), nDocumentos: Number(f.n_documentos),
        creadoEn: t(f.created_at),
    };
}

const SQL_MODELOS = `
  SELECT m.id, m.nombre, m.materia, m.categoria, m.descripcion, m.activo,
         v.id AS version_id, v.version, v.editable, v.schema_json, v.created_at AS version_creada
  FROM modelo m JOIN modelo_version v ON v.modelo_id = m.id
  WHERE v.version = (SELECT MAX(version) FROM modelo_version WHERE modelo_id = m.id)
    AND m.deleted_at IS NULL`;

function contarCampos(json: string): number {
    try {
        const o: unknown = JSON.parse(json);
        return Array.isArray(o) ? o.length : 0;
    } catch {
        return 0;
    }
}

function mapearModelo(f: Fila): ModeloResumen {
    return {
        id: t(f.id), nombre: t(f.nombre), materia: t(f.materia), categoria: t(f.categoria), descripcion: t(f.descripcion),
        activo: Number(f.activo) === 1, versionId: t(f.version_id), version: Number(f.version),
        editable: Number(f.editable) === 1, schemaJson: t(f.schema_json), numCampos: contarCampos(t(f.schema_json)),
        actualizadoEn: t(f.version_creada),
    };
}

export class Consultas {
    constructor(private readonly db: DbPuerto) { }

    async listarExpedientes(): Promise<ExpedienteResumen[]> {
        const filas = await this.db.consultar<Fila>(`${SQL_EXPEDIENTE} ORDER BY e.created_at DESC`);
        return filas.map(mapearExpediente);
    }

    async obtenerExpediente(id: string): Promise<ExpedienteResumen | null> {
        const [f] = await this.db.consultar<Fila>(`${SQL_EXPEDIENTE} AND e.id = ?1`, [id]);
        return f ? mapearExpediente(f) : null;
    }

    async listarPersonas(): Promise<PersonaResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT id, tipo, nombres, apellido_paterno, apellido_materno, apellido_casada, razon_social,
              ci_numero, ci_complemento, ci_expedido, nit, telefono
       FROM persona WHERE deleted_at IS NULL
       ORDER BY COALESCE(razon_social, apellido_paterno, nombres) COLLATE NOCASE`,
        );
        return filas.map((f) => ({
            id: t(f.id), tipo: t(f.tipo), nombre: nombrePersona(f), nit: t(f.nit), telefono: t(f.telefono),
            ci: [t(f.ci_numero) && `${t(f.ci_numero)}${t(f.ci_complemento) ? `-${t(f.ci_complemento)}` : ''}`, t(f.ci_expedido)].filter(Boolean).join(' '),
        }));
    }

    /** Datos completos de una persona, con la forma que espera el formulario y ActualizarPersona. */
    async obtenerPersona(id: string): Promise<DatosPersona | null> {
        const [f] = await this.db.consultar<Fila>('SELECT * FROM persona WHERE id = ?1 AND deleted_at IS NULL', [id]);
        if (!f) return null;
        const g = (v: unknown): 'M' | 'F' | undefined => (v === 'M' || v === 'F' ? v : undefined);
        return {
            tipo: t(f.tipo) === 'juridica' ? 'juridica' : 'natural',
            nombres: t(f.nombres), apellidoPaterno: t(f.apellido_paterno), apellidoMaterno: t(f.apellido_materno),
            apellidoCasada: t(f.apellido_casada), ciNumero: t(f.ci_numero), ciComplemento: t(f.ci_complemento),
            ciExpedido: t(f.ci_expedido), fechaNacimiento: t(f.fecha_nacimiento), genero: g(f.genero),
            estadoCivil: t(f.estado_civil), nacionalidad: t(f.nacionalidad), profesion: t(f.profesion),
            razonSocial: t(f.razon_social), nit: t(f.nit), generoGramatical: g(f.genero_gramatical),
            representanteId: t(f.representante_id), poderRef: t(f.poder_ref), domicilio: t(f.domicilio),
            telefono: t(f.telefono), correo: t(f.correo),
        };
    }
    /** Nombre de una persona vigente (null si no existe o fue archivada). */
    async obtenerNombrePersona(id: string): Promise<string | null> {
        const [f] = await this.db.consultar<Fila>(
            `SELECT tipo, nombres, apellido_paterno, apellido_materno, apellido_casada, razon_social
             FROM persona WHERE id = ?1 AND deleted_at IS NULL`,
            [id],
        );
        return f ? nombrePersona(f) || 'Sin nombre' : null;
    }

    async listarPartes(expedienteId: string): Promise<ParteResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT ep.id AS parte_id, ep.persona_id, ep.rol, ep.orden, ep.domicilio_procesal, ep.datos_override_json,
              p.tipo, p.nombres, p.apellido_paterno, p.apellido_materno, p.apellido_casada, p.razon_social
       FROM expediente_parte ep JOIN persona p ON p.id = ep.persona_id
       WHERE ep.expediente_id = ?1 ORDER BY ep.rol, ep.orden`,
            [expedienteId],
        );
        return filas.map((f) => ({
            id: t(f.parte_id), personaId: t(f.persona_id), rol: t(f.rol), orden: Number(f.orden),
            nombre: nombrePersona(f), domicilioProcesal: t(f.domicilio_procesal), datos: datosParte(f.datos_override_json),
        }));
    }

    async listarDocumentos(expedienteId: string): Promise<DocumentoResumen[]> {
        const docs = await this.db.consultar<Fila>(
            'SELECT id, titulo, estado, created_at FROM documento WHERE expediente_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC',
            [expedienteId],
        );
        const vs = await this.db.consultar<Fila>(
            `SELECT v.id, v.documento_id, v.nro, v.origen, v.created_at, v.ruta, v.sha256
       FROM documento_version v
       WHERE v.documento_id IN (SELECT id FROM documento WHERE expediente_id = ?1 AND deleted_at IS NULL)
       ORDER BY v.nro DESC`,
            [expedienteId],
        );
        const porDoc = new Map<string, VersionResumen[]>();
        for (const v of vs) {
            const k = t(v.documento_id);
            porDoc.set(k, [...(porDoc.get(k) ?? []), {
                id: t(v.id), nro: Number(v.nro), origen: t(v.origen), creadoEn: t(v.created_at), ruta: t(v.ruta), sha256: t(v.sha256),
            }]);
        }
        return docs.map((d) => ({
            id: t(d.id), titulo: t(d.titulo), estado: t(d.estado), creadoEn: t(d.created_at), versiones: porDoc.get(t(d.id)) ?? [],
        }));
    }

    /** Última versión de cada modelo. Por defecto solo los activos. */
    async listarModelos(incluirArchivados = false): Promise<ModeloResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `${SQL_MODELOS} ${incluirArchivados ? '' : 'AND m.activo = 1'} ORDER BY m.nombre COLLATE NOCASE`,
        );
        return filas.map(mapearModelo);
    }

    async obtenerModelo(id: string): Promise<ModeloResumen | null> {
        const [f] = await this.db.consultar<Fila>(`${SQL_MODELOS} AND m.id = ?1`, [id]);
        return f ? mapearModelo(f) : null;
    }

    async listarVersionesModelo(modeloId: string): Promise<VersionModeloResumen[]> {
        const filas = await this.db.consultar<Fila>(
            'SELECT id, version, editable, notas, created_at FROM modelo_version WHERE modelo_id = ?1 ORDER BY version DESC',
            [modeloId],
        );
        return filas.map((f) => ({
            id: t(f.id), version: Number(f.version), editable: Number(f.editable) === 1,
            notas: t(f.notas), creadoEn: t(f.created_at),
        }));
    }
    /** Directorio de personas con sus vínculos (módulo Personas). */
    async listarPersonasDetalle(): Promise<PersonaDetalle[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT p.id, p.tipo, p.nombres, p.apellido_paterno, p.apellido_materno, p.apellido_casada, p.razon_social,
                    p.ci_numero, p.ci_complemento, p.ci_expedido, p.nit, p.telefono, p.correo,
                    (SELECT COUNT(*) FROM expediente e WHERE e.cliente_id = p.id AND e.deleted_at IS NULL) AS n_cliente,
                    (SELECT COUNT(DISTINCT ep.expediente_id) FROM expediente_parte ep
                       JOIN expediente e ON e.id = ep.expediente_id
                      WHERE ep.persona_id = p.id AND e.deleted_at IS NULL) AS n_partes
             FROM persona p
             WHERE p.deleted_at IS NULL
             ORDER BY COALESCE(NULLIF(p.razon_social, ''), NULLIF(p.apellido_paterno, ''), p.nombres) COLLATE NOCASE`,
        );
        return filas.map((f) => {
            const juridica = t(f.tipo) === 'juridica';
            const num = t(f.ci_numero);
            const comp = t(f.ci_complemento);
            const ci = [num && `${num}${comp ? `-${comp}` : ''}`, t(f.ci_expedido)].filter(Boolean).join(' ');
            const nit = t(f.nit);
            return {
                id: t(f.id), tipo: t(f.tipo), nombre: nombrePersona(f), ci, nit, telefono: t(f.telefono), correo: t(f.correo),
                documento: juridica ? (nit ? `NIT ${nit}` : '') : (ci ? `C.I. ${ci}` : ''),
                claveDoc: juridica ? (nit ? `nit:${nit.toLowerCase()}` : '') : (num ? `ci:${num.toLowerCase()}|${comp.toLowerCase()}` : ''),
                nCliente: Number(f.n_cliente), nPartes: Number(f.n_partes),
            };
        });
    }

    /** Expedientes vigentes donde figura la persona (como cliente y/o como parte). */
    async listarVinculosPersona(personaId: string): Promise<VinculoPersona[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT e.id AS expediente_id, e.codigo, e.materia, e.estado, e.tipo, 'cliente' AS rol
             FROM expediente e WHERE e.cliente_id = ?1 AND e.deleted_at IS NULL
             UNION ALL
             SELECT e.id, e.codigo, e.materia, e.estado, e.tipo, ep.rol
             FROM expediente_parte ep JOIN expediente e ON e.id = ep.expediente_id
             WHERE ep.persona_id = ?1 AND e.deleted_at IS NULL
             ORDER BY codigo DESC, rol`,
            [personaId],
        );
        return filas.map((f) => ({
            expedienteId: t(f.expediente_id), codigo: t(f.codigo), materia: t(f.materia),
            estado: t(f.estado), tipo: t(f.tipo), rol: t(f.rol),
        }));
    }

    /** ¿Ya hay otra persona vigente con el mismo C.I. (+ complemento) o NIT? */
    async buscarPorDocumento(
        d: { ciNumero?: string; ciComplemento?: string; nit?: string },
        excluirId = '',
    ): Promise<{ id: string; nombre: string } | null> {
        const ci = (d.ciNumero ?? '').trim();
        const nit = (d.nit ?? '').trim();
        if (!ci && !nit) return null;
        const [f] = await this.db.consultar<Fila>(
            `SELECT id, tipo, nombres, apellido_paterno, apellido_materno, apellido_casada, razon_social
             FROM persona
             WHERE deleted_at IS NULL AND id <> ?1
               AND ((?2 <> '' AND ci_numero = ?2 AND UPPER(COALESCE(ci_complemento, '')) = UPPER(?3))
                 OR (?4 <> '' AND nit = ?4))
             LIMIT 1`,
            [excluirId, ci, (d.ciComplemento ?? '').trim(), nit],
        );
        return f ? { id: t(f.id), nombre: nombrePersona(f) || 'Sin nombre' } : null;
    }
}