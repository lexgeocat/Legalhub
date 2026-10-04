import { z } from 'zod';
import { ErrorDeDatos } from '../../domain/errores';
import { nuevoId } from '../../domain/id';
import type { DbPuerto } from '../puertos/db';
import { insertar } from '../sql';

const txt = z.string().trim().transform((s) => (s === '' ? undefined : s)).optional();
const genero = z.enum(['M', 'F']).optional();

export const EsquemaPersona = z
    .object({
        tipo: z.enum(['natural', 'juridica']),
        nombres: txt, apellidoPaterno: txt, apellidoMaterno: txt, apellidoCasada: txt,
        ciNumero: txt.refine((v) => v === undefined || /^[0-9A-Za-z]+$/.test(v), 'C.I. inválido (solo letras y números)'),
        ciComplemento: txt, ciExpedido: txt,
        fechaNacimiento: txt.refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha inválida (AAAA-MM-DD)'),
        genero, estadoCivil: txt, nacionalidad: txt, profesion: txt,
        razonSocial: txt, nit: txt, generoGramatical: genero,
        representanteId: txt, poderRef: txt, domicilio: txt, telefono: txt,
        correo: txt.refine((v) => v === undefined || z.email().safeParse(v).success, 'Correo inválido'),
    })
    .superRefine((d, ctx) => {
        const falta = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
        if (d.tipo === 'natural') {
            if (!d.nombres) falta('nombres', 'Falta el nombre');
            if (!d.apellidoPaterno && !d.apellidoMaterno) falta('apellidoPaterno', 'Falta el apellido');
            if (!d.genero) falta('genero', 'El género es obligatorio (se usa para la concordancia)');
        } else {
            if (!d.razonSocial) falta('razonSocial', 'Falta la razón social');
            if (!d.generoGramatical) falta('generoGramatical', 'Indica el género gramatical de la razón social');
        }
    });

export type DatosPersona = z.input<typeof EsquemaPersona>;

export class CrearPersona {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(entrada: DatosPersona): Promise<string> {
        const r = EsquemaPersona.safeParse(entrada);
        if (!r.success) throw new ErrorDeDatos(r.error.issues.map((i) => i.message).join('; '));
        const d = r.data;
        const id = nuevoId();
        const ahora = new Date().toISOString();
        await this.db.transaccion(
            [
                insertar('persona', {
                    id, tipo: d.tipo, nombres: d.nombres, apellido_paterno: d.apellidoPaterno,
                    apellido_materno: d.apellidoMaterno, apellido_casada: d.apellidoCasada,
                    ci_numero: d.ciNumero, ci_complemento: d.ciComplemento, ci_expedido: d.ciExpedido,
                    fecha_nacimiento: d.fechaNacimiento, genero: d.genero, estado_civil: d.estadoCivil,
                    nacionalidad: d.nacionalidad, profesion: d.profesion, razon_social: d.razonSocial, nit: d.nit,
                    genero_gramatical: d.generoGramatical, representante_id: d.representanteId, poder_ref: d.poderRef,
                    domicilio: d.domicilio, telefono: d.telefono, correo: d.correo,
                    created_at: ahora, updated_at: ahora,
                }),
            ],
            [{ accion: 'persona.crear', entidad: 'persona', entidadId: id, detalle: { tipo: d.tipo } }],
        );
        return id;
    }
}