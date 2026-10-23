// src/ui/lexai/RenderEscrito.tsx
import { useMemo } from 'react';
import { Icono } from '../_core/comunes';
import { descomponerInline, parsearBloques, type BloqueLegal } from './escrito';

function RenderInline({ texto }: { texto: string }) {
  const piezas = useMemo(() => descomponerInline(texto), [texto]);

  return (
    <>
      {piezas.map((p, idx) => {
        if (p.t === 'b') {
          return (
            <strong key={idx} className="lexai-doc-bold">
              {p.v}
            </strong>
          );
        }
        if (p.t === 'i') {
          return (
            <em key={idx} className="lexai-doc-italic">
              {p.v}
            </em>
          );
        }
        if (p.t === 'ref') {
          return (
            <span key={idx} className="lexai-doc-ref" title="Referencia a fuente de contexto">
              {p.v}
            </span>
          );
        }
        if (p.t === 'campo') {
          return (
            <span key={idx} className="lexai-doc-marcador" title="Dato o campo a completar">
              [{p.v}]
            </span>
          );
        }
        return <span key={idx}>{p.v}</span>;
      })}
    </>
  );
}

export function RenderEscrito({ texto }: { texto: string }) {
  const bloques = useMemo(() => parsearBloques(texto), [texto]);

  return (
    <div className="lexai-doc-formateado">
      {bloques.map((b: BloqueLegal, idx: number) => {
        if (b.t === 'h') {
          if (b.n === 1) return <h2 key={idx} className="lexai-doc-h1"><RenderInline texto={b.texto} /></h2>;
          if (b.n === 2) return <h3 key={idx} className="lexai-doc-h2"><RenderInline texto={b.texto} /></h3>;
          return <h4 key={idx} className="lexai-doc-h3"><RenderInline texto={b.texto} /></h4>;
        }
        if (b.t === 'hr') {
          return <hr key={idx} className="lexai-doc-divisor" />;
        }
        if (b.t === 'firmas') {
          const doble = b.der.length > 0;
          return (
            <div key={idx} className={`lexai-doc-firmas-grid${doble ? ' doble-columna' : ' una-columna'}`}>
              <div className="lexai-doc-firma-col">
                {b.izq.map((linea, lIdx) => (
                  <div key={lIdx} className="lexai-doc-firma-linea">
                    <RenderInline texto={linea} />
                  </div>
                ))}
              </div>
              {doble && (
                <div className="lexai-doc-firma-col">
                  {b.der.map((linea, lIdx) => (
                    <div key={lIdx} className="lexai-doc-firma-linea">
                      <RenderInline texto={linea} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (b.t === 'tabla') {
          return (
            <div key={idx} className="tabla-wrap" style={{ margin: '14px 0' }}>
              <table className="tabla tabla-densa">
                <tbody>
                  {b.filas.map((fila, fIdx) => (
                    <tr key={fIdx}>
                      {fila.map((celda, cIdx) => (
                        fIdx === 0
                          ? <th key={cIdx}><RenderInline texto={celda} /></th>
                          : <td key={cIdx}><RenderInline texto={celda} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.t === 'lista') {
          return b.ordenada ? (
            <ol key={idx} className="lexai-doc-ol">
              {b.items.map((it, iIdx) => (
                <li key={iIdx}><RenderInline texto={it} /></li>
              ))}
            </ol>
          ) : (
            <ul key={idx} className="lexai-doc-ul">
              {b.items.map((it, iIdx) => (
                <li key={iIdx}><RenderInline texto={it} /></li>
              ))}
            </ul>
          );
        }
        if (b.t === 'nota') {
          return (
            <div key={idx} className="lexai-doc-nota">
              <div className="lexai-doc-nota-icono">
                <Icono n="destello" tam={16} />
              </div>
              <div className="lexai-doc-nota-contenido">
                <RenderInline texto={b.texto} />
              </div>
            </div>
          );
        }
        return (
          <p key={idx} className="lexai-doc-p">
            <RenderInline texto={b.texto} />
          </p>
        );
      })}
    </div>
  );
}
