-- Categorías: se unifican con la lista nueva
UPDATE modelo   SET categoria = 'Contrato (Minuta)'             WHERE categoria IN ('Contrato', 'Minuta');
UPDATE modelo   SET categoria = 'Contrato (Documento privado)'  WHERE categoria = 'Documento privado';
UPDATE modelo   SET categoria = 'Instructiva de poder'          WHERE categoria = 'Poder';
UPDATE plantilla SET categoria = 'Contrato (Minuta)'            WHERE categoria IN ('Contrato', 'Minuta');
UPDATE plantilla SET categoria = 'Contrato (Documento privado)' WHERE categoria = 'Documento privado';
UPDATE plantilla SET categoria = 'Instructiva de poder'         WHERE categoria = 'Poder';

-- Materias: las que ya no existen pasan a la más cercana (o quedan sin materia)
UPDATE modelo   SET materia = 'civil'          WHERE materia IN ('contrato', 'documento_privado');
UPDATE modelo   SET materia = 'notarial'       WHERE materia = 'poder';
UPDATE modelo   SET materia = 'administrativo' WHERE materia = 'tramite';
UPDATE modelo   SET materia = NULL             WHERE materia IN ('asesoria', 'otro');
UPDATE plantilla SET materia = 'civil'          WHERE materia IN ('contrato', 'documento_privado');
UPDATE plantilla SET materia = 'notarial'       WHERE materia = 'poder';
UPDATE plantilla SET materia = 'administrativo' WHERE materia = 'tramite';
UPDATE plantilla SET materia = NULL             WHERE materia IN ('asesoria', 'otro');