// src/ui/_core/ConfiguradorTema.tsx
import {
    PERFILES_TEMAS,
    PRESETS,
    PRIMARIOS,
    SUPERFICIES,
    useConfigTema,
    type ConfigTema,
} from './tema';
import { Icono, avisar } from './comunes';

function configsIguales(a: ConfigTema, b: ConfigTema): boolean {
    return (
        a.colorScheme === b.colorScheme &&
        a.primary === b.primary &&
        a.surface === b.surface &&
        a.preset === b.preset &&
        a.layoutTheme === b.layoutTheme
    );
}

/** Configurador de diseño visual inspirado en Verona: Primary, Surface, Presets, Color Scheme y Layout Theme. */
export function ConfiguradorTema({
    variante = 'pagina',
    cerrar,
}: {
    variante?: 'pagina' | 'popover';
    cerrar?: () => void;
}) {
    const { config, esOscuro, actualizar, aplicarPerfil } = useConfigTema();

    const pActivo = PRIMARIOS.find((x) => x.id === config.primary) ?? PRIMARIOS[0];
    const sActiva = SUPERFICIES.find((x) => x.id === config.surface) ?? SUPERFICIES[0];
    const prActivo = PRESETS.find((x) => x.id === config.preset) ?? PRESETS[0];

    const controles = (
        <div className={`tcfg-cuerpo${variante === 'popover' ? ' compacto' : ''}`}>
            {/* 1. Primary */}
            <div className="tcfg-grupo">
                <div className="tcfg-lbl-fila">
                    <span className="tcfg-lbl">Primary</span>
                    <span className="tcfg-val">{pActivo.nombre}</span>
                </div>
                <div className="tcfg-swatches" role="radiogroup" aria-label="Color primario">
                    {PRIMARIOS.map((p) => {
                        const sel = config.primary === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                role="radio"
                                aria-checked={sel}
                                className={`tcfg-swatch${sel ? ' sel' : ''}`}
                                style={{ '--sw': p.swatch } as React.CSSProperties}
                                title={p.nombre}
                                aria-label={`Primary ${p.nombre}`}
                                onClick={() => actualizar({ primary: p.id })}
                            >
                                <span className="tcfg-swatch-dot" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Surface */}
            <div className="tcfg-grupo">
                <div className="tcfg-lbl-fila">
                    <span className="tcfg-lbl">Surface</span>
                    <span className="tcfg-val">{sActiva.nombre}</span>
                </div>
                <div className="tcfg-swatches" role="radiogroup" aria-label="Superficie neutral">
                    {SUPERFICIES.map((s) => {
                        const sel = config.surface === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                role="radio"
                                aria-checked={sel}
                                className={`tcfg-swatch tcfg-swatch-surface${sel ? ' sel' : ''}`}
                                title={s.nombre}
                                aria-label={`Surface ${s.nombre}`}
                                onClick={() => actualizar({ surface: s.id })}
                            >
                                <span
                                    className="tcfg-surface-split"
                                    style={{
                                        background: `linear-gradient(135deg, ${s.swatchTarjeta} 50%, ${s.swatchFondo} 50%)`,
                                    }}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 3. Presets (Aura / Lara / Nora) */}
            <div className="tcfg-grupo">
                <div className="tcfg-lbl-fila">
                    <span className="tcfg-lbl">Presets</span>
                    <span className="tcfg-val">{prActivo.nombre}</span>
                </div>
                <div className="tcfg-seg" role="radiogroup" aria-label="Preset geométrico">
                    {PRESETS.map((pr) => (
                        <button
                            key={pr.id}
                            type="button"
                            role="radio"
                            aria-checked={config.preset === pr.id}
                            className={`tcfg-seg-btn${config.preset === pr.id ? ' activo' : ''}`}
                            title={pr.descripcion}
                            onClick={() => actualizar({ preset: pr.id })}
                        >
                            {pr.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Color Scheme */}
            <div className="tcfg-grupo">
                <div className="tcfg-lbl-fila">
                    <span className="tcfg-lbl">Color Scheme</span>
                    <span className="tcfg-val">{esOscuro ? 'Dark' : 'Light'}</span>
                </div>
                <div className="tcfg-seg tcfg-seg-2" role="radiogroup" aria-label="Esquema de color">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={!esOscuro}
                        className={`tcfg-seg-btn${!esOscuro ? ' activo' : ''}`}
                        onClick={() => actualizar({ colorScheme: 'light' })}
                    >
                        <Icono n="sol" tam={13} />
                        <span>Light</span>
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={esOscuro}
                        className={`tcfg-seg-btn${esOscuro ? ' activo' : ''}`}
                        onClick={() => actualizar({ colorScheme: 'dark' })}
                    >
                        <Icono n="luna" tam={13} />
                        <span>Dark</span>
                    </button>
                </div>
            </div>

            {/* 5. Layout Theme */}
            <div className="tcfg-grupo">
                <div className="tcfg-lbl-fila">
                    <span className="tcfg-lbl">Layout Theme</span>
                    {esOscuro && <span className="tcfg-badge-nota">Solo en Light</span>}
                </div>
                <div className="tcfg-radios" role="radiogroup" aria-label="Tema de estructura">
                    <label className={`tcfg-radio-opt${config.layoutTheme === 'color-scheme' ? ' sel' : ''}`}>
                        <input
                            type="radio"
                            name={`layout-theme-${variante}`}
                            checked={config.layoutTheme === 'color-scheme'}
                            onChange={() => actualizar({ layoutTheme: 'color-scheme' })}
                        />
                        <span>Color Scheme</span>
                    </label>
                    <label
                        className={`tcfg-radio-opt${config.layoutTheme === 'primary' ? ' sel' : ''}${esOscuro ? ' deshab' : ''}`}
                        title={esOscuro ? 'Disponible solo cuando Color Scheme está en Light' : 'Aplica el color primario a la barra lateral y barra superior'}
                    >
                        <input
                            type="radio"
                            name={`layout-theme-${variante}`}
                            checked={config.layoutTheme === 'primary'}
                            disabled={esOscuro}
                            onChange={() => actualizar({ layoutTheme: 'primary' })}
                        />
                        <span>Primary Color <small>(Light Only)</small></span>
                    </label>
                </div>
            </div>
        </div>
    );

    if (variante === 'popover') {
        return (
            <div className="tcfg-popover" role="dialog" aria-label="Configuración de tema">
                <div className="tcfg-popover-cab">
                    <div className="tcfg-popover-tit">
                        <b>Apariencia y Tema</b>
                        <span>{pActivo.nombre} · {sActiva.nombre}</span>
                    </div>
                    {cerrar && (
                        <button type="button" className="btn btn-fan btn-xs" onClick={cerrar} aria-label="Cerrar">
                            ✕
                        </button>
                    )}
                </div>
                {controles}
                <div className="tcfg-popover-perfiles">
                    <span className="tcfg-lbl">Perfiles rápidos</span>
                    <div className="tcfg-chips">
                        {PERFILES_TEMAS.map((pf) => {
                            const activo = configsIguales(config, pf.config);
                            return (
                                <button
                                    key={pf.id}
                                    type="button"
                                    className={`tcfg-chip${activo ? ' sel' : ''}`}
                                    onClick={() => aplicarPerfil(pf.id)}
                                >
                                    {pf.nombre}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="tcfg-panel-pagina">
            <div className="tcfg-grid-pagina">
                {/* Columna izquierda: Vista previa + Perfiles rápidos */}
                <div className="tcfg-col-preview">
                    <div className="tcfg-preview-live" aria-hidden="true">
                        <div className="tcfg-pv-top">
                            <span className="tcfg-pv-dots">
                                <i /><i /><i />
                            </span>
                            <span className="tcfg-pv-title">LEGAL-HUB · {prActivo.nombre}</span>
                        </div>
                        <div className="tcfg-pv-body">
                            <div className="tcfg-pv-nav">
                                <div className="tcfg-pv-logo" />
                                <div className="tcfg-pv-nav-item activo" />
                                <div className="tcfg-pv-nav-item" />
                                <div className="tcfg-pv-nav-item" />
                            </div>
                            <div className="tcfg-pv-workspace">
                                <div className="tcfg-pv-head">
                                    <span className="tcfg-pv-h1" />
                                    <span className="tcfg-pv-btn" />
                                </div>
                                <div className="tcfg-pv-card">
                                    <div className="tcfg-pv-card-bar" />
                                    <div className="tcfg-pv-card-lines">
                                        <span />
                                        <span className="corto" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="tcfg-perfiles-bloque">
                        <div className="tcfg-lbl-fila">
                            <span className="tcfg-lbl">Perfiles predefinidos</span>
                            <span className="tcfg-val">1 clic</span>
                        </div>
                        <div className="tcfg-perfiles-lista">
                            {PERFILES_TEMAS.map((pf) => {
                                const activo = configsIguales(config, pf.config);
                                const pp = PRIMARIOS.find((x) => x.id === pf.config.primary) ?? PRIMARIOS[0];
                                const ss = SUPERFICIES.find((x) => x.id === pf.config.surface) ?? SUPERFICIES[0];
                                return (
                                    <button
                                        key={pf.id}
                                        type="button"
                                        className={`tcfg-perfil-card${activo ? ' sel' : ''}`}
                                        onClick={() => {
                                            aplicarPerfil(pf.id);
                                            avisar(`Perfil ${pf.nombre} aplicado`);
                                        }}
                                    >
                                        <span
                                            className="tcfg-perfil-muestra"
                                            style={{
                                                background: pf.config.colorScheme === 'dark' ? ss.oscuro.bg : ss.claro.bg,
                                                borderColor: pp.swatch,
                                            }}
                                        >
                                            <i style={{ background: pp.swatch }} />
                                        </span>
                                        <span className="tcfg-perfil-txt">
                                            <b>{pf.nombre}</b>
                                            <small>{pf.subtitulo}</small>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Columna derecha: Ajustes granulares Verona */}
                <div className="tcfg-col-ajustes">
                    {controles}
                </div>
            </div>
        </div>
    );
}
