import { useState, type FormEvent } from 'react';
import type { DatosPersona } from '../../application/casosDeUso/crearPersona';
import { Aviso, Campo, datosDeForm } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Personas() {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarPersonas(), []);
    const [tipo, setTipo] = useState<'natural' | 'juridica'>('natural');
    const [error, setError] = useState<string | null>(null);

    async function crear(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        const f = datosDeForm(form);
        try {
            await s.crearPersona.ejecutar({ ...f, tipo } as unknown as DatosPersona);
            form.reset();
            setError(null);
            lista.recargar();
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <>
            <h2>Personas</h2>
            <Aviso error={error ?? lista.error} />
            <table>
                <thead><tr><th>Nombre</th><th>Tipo</th><th>C.I.</th></tr></thead>
                <tbody>
                    {lista.datos?.map((p) => <tr key={p.id}><td>{p.nombre}</td><td>{p.tipo}</td><td>{p.ci}</td></tr>)}
                </tbody>
            </table>

            <h3>Nueva persona</h3>
            <form className="panel" onSubmit={crear}>
                <Campo etiqueta="Tipo">
                    <select value={tipo} onChange={(e) => setTipo(e.target.value as 'natural' | 'juridica')}>
                        <option value="natural">Natural</option>
                        <option value="juridica">Jurídica</option>
                    </select>
                </Campo>
                {tipo === 'natural' ? (
                    <>
                        <Campo etiqueta="Nombres *"><input name="nombres" /></Campo>
                        <Campo etiqueta="Apellido paterno"><input name="apellidoPaterno" /></Campo>
                        <Campo etiqueta="Apellido materno"><input name="apellidoMaterno" /></Campo>
                        <Campo etiqueta="Apellido de casada"><input name="apellidoCasada" /></Campo>
                        <Campo etiqueta="C.I. (número)"><input name="ciNumero" /></Campo>
                        <Campo etiqueta="Complemento"><input name="ciComplemento" /></Campo>
                        <Campo etiqueta="Expedido en"><input name="ciExpedido" placeholder="LP, CB, SC…" /></Campo>
                        <Campo etiqueta="Género *">
                            <select name="genero" defaultValue=""><option value="" disabled>Elegir…</option><option value="M">Masculino</option><option value="F">Femenino</option></select>
                        </Campo>
                        <Campo etiqueta="Estado civil">
                            <select name="estadoCivil" defaultValue="">
                                <option value="">—</option><option>soltero</option><option>casado</option><option>divorciado</option><option>viudo</option><option>union libre</option>
                            </select>
                        </Campo>
                        <Campo etiqueta="Nacionalidad"><input name="nacionalidad" placeholder="boliviano" /></Campo>
                        <Campo etiqueta="Profesión"><input name="profesion" /></Campo>
                        <Campo etiqueta="Fecha de nacimiento"><input type="date" name="fechaNacimiento" /></Campo>
                    </>
                ) : (
                    <>
                        <Campo etiqueta="Razón social *"><input name="razonSocial" /></Campo>
                        <Campo etiqueta="NIT"><input name="nit" /></Campo>
                        <Campo etiqueta="Género gramatical *">
                            <select name="generoGramatical" defaultValue=""><option value="" disabled>Elegir…</option><option value="M">Masculino (el)</option><option value="F">Femenino (la)</option></select>
                        </Campo>
                        <Campo etiqueta="Representante">
                            <select name="representanteId" defaultValue="">
                                <option value="">—</option>
                                {lista.datos?.filter((p) => p.tipo === 'natural').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Poder (referencia)"><input name="poderRef" /></Campo>
                    </>
                )}
                <Campo etiqueta="Domicilio"><input name="domicilio" /></Campo>
                <Campo etiqueta="Teléfono"><input name="telefono" /></Campo>
                <Campo etiqueta="Correo"><input name="correo" /></Campo>
                <div className="ancho"><button type="submit">Guardar persona</button></div>
            </form>
        </>
    );
}