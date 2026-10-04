import type { Configuracion } from '../../application/configuracion';
import type { ConstructorContexto } from '../../application/puertos/contexto';
import type { DbPuerto, Fila } from '../../application/puertos/db';
import { ErrorDeDatos } from '../../domain/errores';
import { ci } from '../../domain/filtros/ci';
import { hoyISO } from '../../domain/filtros/fecha';
import { atributoConcordado, estadoCivilConcordado, nombrePersona } from '../../domain/personas';
import { fusionarProfundo } from '../../domain/rutas';
import { claveNormalizada, normalizarRol, pluralRol } from '../../domain/texto';

type Ctx = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? '' : String(v));
const ROLES_BASE = ['demandante', 'demandado', 'tercero', 'acusado', 'denunciante'];

function json(v: unknown): Ctx {
    try {
        const o: unknown = JSON.parse(s(v) || '{}');
        return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Ctx) : {};
    } catch {
        return {};
    }
}

function personaCtx(p: Fila, parte: Fila | null = null, representante: Fila | null = null): Ctx {
    const juridica = s(p.tipo) === 'juridica';
    const g0 = juridica ? s(p.genero_gramatical) : s(p.genero);
    const genero = g0 === 'M' || g0 === 'F' ? g0 : null;
    const ciDatos = [s(p.ci_numero), s(p.ci_complemento), s(p.ci_expedido)];
    const nombre = nombrePersona(p);
    const base: Ctx = {
        id: s(p.id), tipo: s(p.tipo), nombre, nombre_completo: nombre,
        nombres: s(p.nombres), apellido_paterno: s(p.apellido_paterno), apellido_materno: s(p.apellido_materno),
        apellido_casada: s(p.apellido_casada),
        ci: s(p.ci_numero) ? ci(ciDatos) : '', ci_datos: ciDatos,
        ci_numero: ciDatos[0], ci_complemento: ciDatos[1], ci_expedido: ciDatos[2],
        genero,
        estado_civil: estadoCivilConcordado(s(p.estado_civil), genero),
        nacionalidad: atributoConcordado(s(p.nacionalidad), genero),
        profesion: atributoConcordado(s(p.profesion), genero),
        fecha_nacimiento: s(p.fecha_nacimiento), domicilio: s(p.domicilio), telefono: s(p.telefono),
        correo: s(p.correo), razon_social: s(p.razon_social), nit: s(p.nit), poder_ref: s(p.poder_ref),
        domicilio_procesal: s(parte?.domicilio_procesal),
        representante: representante ? personaCtx(representante) : null,
        porcentaje: '',
    };
    return fusionarProfundo(base, json(parte?.datos_override_json));
}

export class ConstructorContextoDb implements ConstructorContexto {
    constructor(
        private readonly db: DbPuerto,
        private readonly config: Configuracion,
        private readonly ahora: () => Date = () => new Date(),
    ) { }

    async construir(expedienteId: string, datosFormulario: Ctx): Promise<Ctx> {
        const [exp] = await this.db.consultar<Fila>(
            'SELECT * FROM expediente WHERE id = ?1 AND deleted_at IS NULL',
            [expedienteId],
        );
        if (!exp) throw new ErrorDeDatos(`Expediente no encontrado: ${expedienteId}`);

        const cache = new Map<string, Fila | null>();
        const persona = async (id: string): Promise<Fila | null> => {
            if (!id) return null;
            if (!cache.has(id)) {
                const [p] = await this.db.consultar<Fila>('SELECT * FROM persona WHERE id = ?1 AND deleted_at IS NULL', [id]);
                cache.set(id, p ?? null);
            }
            return cache.get(id) ?? null;
        };

        const filasPartes = await this.db.consultar<Fila>(
            `SELECT p.*, ep.id AS parte_id, ep.rol, ep.orden, ep.domicilio_procesal,
              ep.representante_id AS parte_representante_id, ep.datos_override_json
       FROM expediente_parte ep JOIN persona p ON p.id = ep.persona_id
       WHERE ep.expediente_id = ?1 AND p.deleted_at IS NULL ORDER BY ep.rol, ep.orden`,
            [expedienteId],
        );

        const roles: Record<string, Ctx[]> = {};
        const singularDe: Record<string, string> = {};
        for (const r of ROLES_BASE) {
            roles[pluralRol(r)] = [];
            singularDe[pluralRol(r)] = r;
        }
        for (const f of filasPartes) {
            const rol = normalizarRol(s(f.rol));
            const plural = pluralRol(rol);
            const rep = await persona(s(f.parte_representante_id) || s(f.representante_id));
            singularDe[plural] = rol;
            (roles[plural] ??= []).push(personaCtx(f, f, rep));
        }

        const vacia = personaCtx({});
        const singulares: Ctx = {};
        const flags: Record<string, boolean> = {};
        for (const [plural, lista] of Object.entries(roles)) {
            flags[`hay_${plural}`] = lista.length > 0;
            const singular = singularDe[plural];
            if (singular && singular !== plural) singulares[singular] = lista[0] ?? vacia;
        }

        const cliente = personaCtx((await persona(s(exp.cliente_id))) ?? {});
        const cfg = await this.config.cargar();
        const abogado: Ctx = {
            ...personaCtx((await persona(cfg.abogadoPersonaId ?? '')) ?? {}),
            matricula_profesional: cfg.abogadoMatricula,
            domicilio_procesal: cfg.abogadoDomicilioProcesal,
        };

        const primero = (roles.demandantes?.[0] ?? cliente) as Ctx;
        flags.hay_conyuge = ['casado', 'casada'].includes(claveNormalizada(s(primero.estado_civil)));

        const filasInm = await this.db.consultar<Fila>(
            `SELECT i.* FROM expediente_inmueble ei JOIN inmueble i ON i.id = ei.inmueble_id
       WHERE ei.expediente_id = ?1 AND i.deleted_at IS NULL`,
            [expedienteId],
        );
        const inmuebles: Ctx[] = [];
        for (const i of filasInm) {
            const titulares = await this.db.consultar<Fila>(
                `SELECT p.*, it.porcentaje FROM inmueble_titular it JOIN persona p ON p.id = it.persona_id
         WHERE it.inmueble_id = ?1 AND p.deleted_at IS NULL`,
                [i.id],
            );
            const col = json(i.colindancias_json);
            inmuebles.push({
                id: s(i.id), tipo: s(i.tipo), departamento: s(i.departamento), provincia: s(i.provincia),
                municipio: s(i.municipio), localidad: s(i.localidad),
                superficie_m2: s(i.superficie_m2), superficie: s(i.superficie_m2),
                matricula: s(i.matricula), codigo_catastral: s(i.codigo_catastral), ubicacion: s(i.ubicacion),
                colindancias: { norte: s(col.norte), sur: s(col.sur), este: s(col.este), oeste: s(col.oeste) },
                gravamenes: s(i.gravamenes), observaciones: s(i.observaciones),
                titulares: titulares.map((t) => ({ ...personaCtx(t), porcentaje: s(t.porcentaje) })),
            });
        }

        const base: Ctx = {
            ...roles, ...singulares, ...flags,
            partes: roles,
            expediente: {
                codigo: s(exp.codigo), materia: s(exp.materia), referencia: s(exp.referencia),
                juzgado: s(exp.juzgado), nro_causa: s(exp.nro_causa), estado: s(exp.estado),
            },
            cliente, abogado, inmuebles, caso: {},
            hoy: hoyISO(this.ahora()),
        };
        return fusionarProfundo(base, datosFormulario);
    }
}