use crate::db::{self, EstadoDb};
use rusqlite::{backup::Backup, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Seek, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, State};
use zip::write::SimpleFileOptions;

const CARPETAS: [&str; 2] = ["Modelos", "Expedientes"];
const MAGIC_AGE: &[u8] = b"age-encryption.org/";

#[derive(Serialize, Deserialize)]
struct ArchivoManifest {
    ruta: String,
    sha256: String,
    bytes: u64,
}

#[derive(Serialize, Deserialize)]
struct Manifest {
    app_version: String,
    esquema: i64,
    fecha: String,
    archivos: Vec<ArchivoManifest>,
}

fn err<E: std::fmt::Display>(ctx: &'static str) -> impl FnOnce(E) -> String {
    move |e| format!("{ctx}: {e}")
}

struct Temporal(PathBuf);
impl Temporal {
    fn crear(ruta: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&ruta).map_err(err("No se pudo crear una carpeta temporal"))?;
        Ok(Temporal(ruta))
    }
}
impl Drop for Temporal {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn copiar_con_hash<R: Read, W: Write>(mut origen: R, mut destino: W) -> io::Result<(String, u64)> {
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    let mut total = 0u64;
    loop {
        let n = origen.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        destino.write_all(&buf[..n])?;
        total += n as u64;
    }
    Ok((hex::encode(hasher.finalize()), total))
}

fn listar(dir: &Path, salida: &mut Vec<PathBuf>) -> io::Result<()> {
    for entrada in fs::read_dir(dir)? {
        let ruta = entrada?.path();
        if ruta.is_dir() {
            listar(&ruta, salida)?;
        } else {
            salida.push(ruta);
        }
    }
    Ok(())
}

fn nombre_zip(base: &Path, ruta: &Path) -> Result<String, String> {
    let rel = ruta.strip_prefix(base).map_err(err("Ruta fuera de la carpeta raíz"))?;
    Ok(rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/"))
}

fn ruta_valida(n: &str) -> bool {
    let segura = !n.is_empty()
        && !n.starts_with('/')
        && !n.contains('\\')
        && !n.contains(':')
        && n.split('/').all(|s| !s.is_empty() && s != "." && s != "..");
    let conocida = n == db::NOMBRE_DB || CARPETAS.iter().any(|c| n.starts_with(&format!("{c}/")));
    segura && conocida
}

fn es_age(ruta: &Path) -> Result<bool, String> {
    let mut f = File::open(ruta).map_err(err("No se pudo abrir el respaldo"))?;
    let mut cab = vec![0u8; MAGIC_AGE.len()];
    let n = f.read(&mut cab).map_err(err("No se pudo leer el respaldo"))?;
    Ok(cab[..n].starts_with(MAGIC_AGE))
}

fn cifrar(origen: &Path, destino: &Path, clave: &str) -> Result<(), String> {
    let secreto: age::secrecy::SecretString = clave.to_owned().into();
    let enc = age::Encryptor::with_user_passphrase(secreto);
    let salida = BufWriter::new(File::create(destino).map_err(err("No se pudo crear el respaldo cifrado"))?);
    let mut w = enc.wrap_output(salida).map_err(err("Error de cifrado"))?;
    let mut r = BufReader::new(File::open(origen).map_err(err("No se pudo leer el paquete"))?);
    io::copy(&mut r, &mut w).map_err(err("Error de cifrado"))?;
    let mut fin = w.finish().map_err(err("Error de cifrado"))?;
    fin.flush().map_err(err("Error de cifrado"))?;
    Ok(())
}

fn descifrar(origen: &Path, destino: &Path, clave: &str) -> Result<(), String> {
    let secreto: age::secrecy::SecretString = clave.to_owned().into();
    let lector = BufReader::new(File::open(origen).map_err(err("No se pudo abrir el respaldo"))?);
    let dec = age::Decryptor::new(lector).map_err(err("Respaldo inválido"))?;
    if !dec.is_scrypt() {
        return Err("El respaldo no está cifrado con contraseña".into());
    }
    let identidad = age::scrypt::Identity::new(secreto);
    let mut r = dec
        .decrypt(std::iter::once(&identidad as &dyn age::Identity))
        .map_err(|_| "Contraseña incorrecta o respaldo dañado".to_string())?;
    let mut w = BufWriter::new(File::create(destino).map_err(err("No se pudo crear el archivo temporal"))?);
    io::copy(&mut r, &mut w).map_err(|_| "Contraseña incorrecta o respaldo dañado".to_string())?;
    w.flush().map_err(err("No se pudo escribir el archivo temporal"))?;
    Ok(())
}

fn verificar_zip(ruta: &Path) -> Result<Manifest, String> {
    let f = File::open(ruta).map_err(err("No se pudo abrir el paquete"))?;
    let mut zip = zip::ZipArchive::new(BufReader::new(f)).map_err(err("El respaldo no es un ZIP válido"))?;

    let manifest: Manifest = {
        let mut m = zip.by_name("manifest.json").map_err(err("Falta manifest.json"))?;
        let mut s = String::new();
        m.read_to_string(&mut s).map_err(err("manifest.json ilegible"))?;
        serde_json::from_str(&s).map_err(err("manifest.json inválido"))?
    };

    if zip.len() != manifest.archivos.len() + 1 {
        return Err("El respaldo contiene archivos que no figuran en el manifiesto".into());
    }
    for a in &manifest.archivos {
        if !ruta_valida(&a.ruta) {
            return Err(format!("Ruta no permitida en el respaldo: {}", a.ruta));
        }
        let mut e = zip.by_name(&a.ruta).map_err(err("Falta un archivo del manifiesto"))?;
        let (sha, bytes) = copiar_con_hash(&mut e, io::sink()).map_err(err("Error leyendo el respaldo"))?;
        if sha != a.sha256 || bytes != a.bytes {
            return Err(format!("Verificación fallida (hash distinto): {}", a.ruta));
        }
    }
    Ok(manifest)
}

fn verificar_archivo(ruta: &Path, contrasena: Option<&str>, trabajo: &Path) -> Result<Manifest, String> {
    if es_age(ruta)? {
        let clave = contrasena
            .filter(|c| !c.is_empty())
            .ok_or("El respaldo está cifrado: falta la contraseña")?;
        let plano = trabajo.join("verificacion.zip");
        descifrar(ruta, &plano, clave)?;
        let r = verificar_zip(&plano);
        let _ = fs::remove_file(&plano);
        r
    } else {
        verificar_zip(ruta)
    }
}

fn agregar<W: Write + Seek>(
    zip: &mut zip::ZipWriter<W>,
    opts: SimpleFileOptions,
    nombre: &str,
    origen: &Path,
    lista: &mut Vec<ArchivoManifest>,
) -> Result<(), String> {
    zip.start_file(nombre, opts).map_err(err("Error de ZIP"))?;
    let f = File::open(origen).map_err(err("No se pudo abrir un archivo a respaldar"))?;
    let (sha256, bytes) = copiar_con_hash(BufReader::new(f), &mut *zip).map_err(err("Error copiando al ZIP"))?;
    lista.push(ArchivoManifest { ruta: nombre.to_string(), sha256, bytes });
    Ok(())
}

fn crear_interno(
    estado: &EstadoDb,
    destino: &Path,
    contrasena: Option<&str>,
    raiz: Option<&Path>,
) -> Result<(), String> {
    if destino.exists() {
        return Err("Ya existe un archivo con ese nombre; elige otro".into());
    }
    let padre = destino
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or("Ruta de destino inválida")?;
    fs::create_dir_all(padre).map_err(err("No se pudo crear la carpeta de destino"))?;
    let tmp = Temporal::crear(padre.join(format!(".lh_tmp_{}", db::ahora())))?;

    let snap = tmp.0.join(db::NOMBRE_DB);
    let esquema: i64;
    let fecha: String;
    {
        let conn = estado.conexion.lock().map_err(|e| e.to_string())?;
        let mut dst = Connection::open(&snap).map_err(err("No se pudo crear la instantánea"))?;
        {
            let b = Backup::new(&conn, &mut dst).map_err(err("Error de instantánea"))?;
            b.run_to_completion(256, Duration::from_millis(5), None)
                .map_err(err("Error de instantánea"))?;
        }
        esquema = conn
            .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", [], |f| f.get(0))
            .map_err(err("No se pudo leer la versión del esquema"))?;
        fecha = conn
            .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now')", [], |f| f.get(0))
            .map_err(err("No se pudo leer la fecha"))?;
    }

    let mut origenes: Vec<(String, PathBuf)> = vec![(db::NOMBRE_DB.to_string(), snap)];
    if let Some(r) = raiz {
        for carpeta in CARPETAS {
            let base = r.join(carpeta);
            if !base.is_dir() {
                continue;
            }
            let mut lista = Vec::new();
            listar(&base, &mut lista).map_err(err("No se pudo recorrer la carpeta"))?;
            for f in lista {
                origenes.push((nombre_zip(r, &f)?, f));
            }
        }
    }

    let zip_path = tmp.0.join("paquete.zip");
    {
        let f = File::create(&zip_path).map_err(err("No se pudo crear el ZIP"))?;
        let mut zip = zip::ZipWriter::new(BufWriter::new(f));
        let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        let mut archivos = Vec::with_capacity(origenes.len());
        for (nombre, ruta) in &origenes {
            agregar(&mut zip, opts.clone(), nombre, ruta, &mut archivos)?;
        }
        let manifest = Manifest {
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            esquema,
            fecha,
            archivos,
        };
        let json = serde_json::to_vec_pretty(&manifest).map_err(err("Error de manifiesto"))?;
        zip.start_file("manifest.json", opts.clone()).map_err(err("Error de ZIP"))?;
        zip.write_all(&json).map_err(err("Error de ZIP"))?;
        zip.finish().map_err(err("Error al cerrar el ZIP"))?;
    }

    let salida = tmp.0.join("salida.lhbak");
    match contrasena.filter(|c| !c.is_empty()) {
        Some(c) => cifrar(&zip_path, &salida, c)?,
        None => {
            fs::rename(&zip_path, &salida).map_err(err("No se pudo preparar el respaldo"))?;
        }
    }
    verificar_archivo(&salida, contrasena, &tmp.0)?;
    fs::rename(&salida, destino).map_err(err("No se pudo mover el respaldo a su destino"))?;
    Ok(())
}

fn extraer(zip_path: &Path, manifest: &Manifest, dir_db: &Path, dir_raiz: Option<&Path>) -> Result<(), String> {
    let f = File::open(zip_path).map_err(err("No se pudo abrir el paquete"))?;
    let mut zip = zip::ZipArchive::new(BufReader::new(f)).map_err(err("ZIP inválido"))?;
    for a in &manifest.archivos {
        let destino: PathBuf = if a.ruta == db::NOMBRE_DB {
            dir_db.join(db::NOMBRE_DB)
        } else {
            let raiz = dir_raiz.ok_or("El respaldo incluye Modelos/Expedientes: falta la carpeta raíz")?;
            a.ruta.split('/').fold(raiz.to_path_buf(), |p, s| p.join(s))
        };
        if let Some(p) = destino.parent() {
            fs::create_dir_all(p).map_err(err("No se pudo crear una carpeta"))?;
        }
        let mut e = zip.by_name(&a.ruta).map_err(err("Falta un archivo en el paquete"))?;
        let mut w = BufWriter::new(File::create(&destino).map_err(err("No se pudo crear un archivo"))?);
        io::copy(&mut e, &mut w).map_err(err("Error al extraer"))?;
        w.flush().map_err(err("Error al extraer"))?;
    }
    Ok(())
}

fn integridad(ruta: &Path) -> Result<(), String> {
    let c = Connection::open(ruta).map_err(err("No se pudo abrir la base restaurada"))?;
    let r: String = c
        .query_row("PRAGMA integrity_check", [], |f| f.get(0))
        .map_err(err("integrity_check falló"))?;
    if r == "ok" {
        Ok(())
    } else {
        Err(format!("La base restaurada está dañada: {r}"))
    }
}

fn intercambiar(actual: &Path, aparte: &Path, nueva: &Path) -> Result<(), String> {
    if actual.exists() {
        fs::rename(actual, aparte).map_err(err("No se pudo apartar la base actual"))?;
    }
    fs::rename(nueva, actual).map_err(err("No se pudo colocar la base restaurada"))
}

#[tauri::command(async)]
pub fn crear_backup(
    estado: State<'_, EstadoDb>,
    destino: String,
    contrasena: Option<String>,
    raiz: Option<String>,
) -> Result<String, String> {
    let destino = PathBuf::from(destino);
    crear_interno(&estado, &destino, contrasena.as_deref(), raiz.as_deref().map(Path::new))?;
    Ok(destino.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn restaurar_backup(
    app: AppHandle,
    estado: State<'_, EstadoDb>,
    origen: String,
    contrasena: Option<String>,
    raiz: Option<String>,
) -> Result<String, String> {
    let origen = PathBuf::from(origen);
    if !origen.is_file() {
        return Err("No se encontró el archivo de respaldo".into());
    }
    let dir_datos = db::dir_datos(&app)?;
    let raiz = raiz.map(PathBuf::from);
    let marca = db::ahora();

    let tmp_db = Temporal::crear(dir_datos.join(format!("_restore_{marca}")))?;
    let tmp_raiz = match &raiz {
        Some(r) => Some(Temporal::crear(r.join(format!("_restore_{marca}")))?),
        None => None,
    };

    let paquete = if es_age(&origen)? {
        let clave = contrasena
            .as_deref()
            .filter(|c| !c.is_empty())
            .ok_or("El respaldo está cifrado: falta la contraseña")?;
        let z = tmp_db.0.join("paquete.zip");
        descifrar(&origen, &z, clave)?;
        z
    } else {
        origen.clone()
    };

    let manifest = verificar_zip(&paquete)?;
    if manifest.esquema > db::esquema_actual() {
        return Err("El respaldo es de una versión más nueva de Legal-Hub".into());
    }
    extraer(&paquete, &manifest, &tmp_db.0, tmp_raiz.as_ref().map(|t| t.0.as_path()))?;

    let nueva_db = tmp_db.0.join(db::NOMBRE_DB);
    if !nueva_db.is_file() {
        return Err("El respaldo no contiene la base de datos".into());
    }
    integridad(&nueva_db)?;

    let previos = dir_datos.join("previos");
    fs::create_dir_all(&previos).map_err(err("No se pudo crear la carpeta de copias previas"))?;
    let previo = previos.join(format!("previo_restauracion_{marca}.lhbak"));
    crear_interno(&estado, &previo, contrasena.as_deref(), raiz.as_deref())?;

    let ruta_actual = dir_datos.join(db::NOMBRE_DB);
    let aparte = dir_datos.join(format!("{}.previo_{marca}", db::NOMBRE_DB));
    {
        let mut guard = estado.conexion.lock().map_err(|e| e.to_string())?;
        let en_memoria = Connection::open_in_memory().map_err(err("Error interno"))?;
        drop(std::mem::replace(&mut *guard, en_memoria));
        for sufijo in ["-wal", "-shm"] {
            let _ = fs::remove_file(dir_datos.join(format!("{}{sufijo}", db::NOMBRE_DB)));
        }
        match intercambiar(&ruta_actual, &aparte, &nueva_db).and_then(|_| db::abrir(&ruta_actual)) {
            Ok(c) => *guard = c,
            Err(e) => {
                if aparte.exists() {
                    let _ = fs::remove_file(&ruta_actual);
                    let _ = fs::rename(&aparte, &ruta_actual);
                }
                if let Ok(c) = db::abrir(&ruta_actual) {
                    *guard = c;
                }
                return Err(format!("No se pudo restaurar (se conservó la base actual): {e}"));
            }
        }
    }

    if let (Some(r), Some(t)) = (&raiz, &tmp_raiz) {
        for c in CARPETAS {
            let nueva = t.0.join(c);
            if !nueva.exists() {
                continue;
            }
            let actual = r.join(c);
            if actual.exists() {
                fs::rename(&actual, r.join(format!("{c}.previo_{marca}")))
                    .map_err(err("No se pudo apartar una carpeta actual"))?;
            }
            fs::rename(&nueva, &actual).map_err(err("No se pudo colocar una carpeta restaurada"))?;
        }
    }

    Ok(format!("Restauración completa. Copia previa en: {}", previo.display()))
}

#[tauri::command(async)]
pub fn sha256_archivo(ruta: String) -> Result<String, String> {
    let f = File::open(&ruta).map_err(err("No se pudo abrir el archivo"))?;
    let (hash, _) = copiar_con_hash(BufReader::new(f), io::sink()).map_err(err("No se pudo leer el archivo"))?;
    Ok(hash)
}