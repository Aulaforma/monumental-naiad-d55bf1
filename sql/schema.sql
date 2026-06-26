-- Eliminar tablas si existen para empezar limpio (opcional)
DROP TABLE IF EXISTS documentos_generados CASCADE;
DROP TABLE IF EXISTS compras CASCADE;
DROP TABLE IF EXISTS movimientos_creditos CASCADE;
DROP TABLE IF EXISTS packs_creditos CASCADE;
DROP TABLE IF EXISTS perfiles CASCADE;

-- 1. Tabla de Perfiles de Usuario (Extiende auth.users)
CREATE TABLE perfiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nombre_completo TEXT,
    correo TEXT UNIQUE NOT NULL,
    tipo_usuario TEXT,
    creditos_disponibles INTEGER DEFAULT 0,
    prueba_gratuita_usada BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    estado_usuario TEXT DEFAULT 'activo', -- activo, suspendido
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Función para verificar si un usuario es administrador de forma segura (evitando recursión RLS)
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS en perfiles
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su propio perfil" 
ON perfiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" 
ON perfiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Usuarios pueden crear su propio perfil" 
ON perfiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Administradores pueden ver y editar todo" 
ON perfiles FOR ALL USING (
    public.es_admin()
);

-- Función y Trigger para crear perfil automáticamente cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre_completo, correo, tipo_usuario, creditos_disponibles, prueba_gratuita_usada)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'nombre_completo', 
    new.email, 
    new.raw_user_meta_data->>'tipo_usuario',
    1, -- 1 Crédito gratis inicial
    TRUE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Tabla de Packs de Créditos
CREATE TABLE packs_creditos (
    id_pack SERIAL PRIMARY KEY,
    nombre_pack TEXT NOT NULL,
    cantidad_creditos INTEGER NOT NULL,
    precio INTEGER NOT NULL,
    descripcion TEXT
);

INSERT INTO packs_creditos (nombre_pack, cantidad_creditos, precio, descripcion) VALUES
('Pack Prueba', 5, 2990, 'Ideal para probar la plataforma.'),
('Pack Inicio', 10, 4990, 'Ideal para comenzar.'),
('Pack Docente', 15, 6990, 'Pensado para docentes activos.'),
('Pack Aula', 30, 11990, 'Uso frecuente para tu curso.'),
('Pack Pro', 50, 17990, 'Para un uso avanzado.'),
('Pack UTP', 100, 29990, 'Para coordinadores y jefes de UTP.'),
('Pack Institucional', 200, 49990, 'Para uso de todo el colegio.');

-- RLS: Todos pueden ver los packs, solo admin puede modificar
ALTER TABLE packs_creditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Packs visibles para todos" ON packs_creditos FOR SELECT USING (true);


-- 3. Tabla de Compras (Transacciones manuales)
CREATE TABLE compras (
    id_compra UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES perfiles(id) ON DELETE CASCADE,
    id_pack INTEGER REFERENCES packs_creditos(id_pack),
    monto INTEGER NOT NULL,
    metodo_pago TEXT DEFAULT 'transferencia',
    estado_pago TEXT DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
    fecha_compra TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    fecha_activacion TIMESTAMP WITH TIME ZONE
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus compras" ON compras FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "Usuarios insertan sus compras" ON compras FOR INSERT WITH CHECK (auth.uid() = id_usuario);
CREATE POLICY "Admins gestionan compras" ON compras FOR ALL USING (
    public.es_admin()
);


-- 4. Tabla de Documentos Generados (Historial)
CREATE TABLE documentos_generados (
    id_documento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES perfiles(id) ON DELETE CASCADE,
    asignatura TEXT,
    curso TEXT,
    tipo_instrumento TEXT,
    creditos_usados INTEGER NOT NULL DEFAULT 1,
    nombre_documento TEXT,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE documentos_generados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven su historial" ON documentos_generados FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "Servidor inserta historial" ON documentos_generados FOR INSERT WITH CHECK (auth.uid() = id_usuario);


-- 5. Tabla de Movimientos de Créditos (Auditoría)
CREATE TABLE movimientos_creditos (
    id_movimiento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES perfiles(id) ON DELETE CASCADE,
    tipo_movimiento TEXT, -- carga, consumo, ajuste, devolucion
    cantidad_creditos INTEGER,
    motivo TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    usuario_admin UUID REFERENCES perfiles(id) NULL
);

ALTER TABLE movimientos_creditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios pueden ver sus movimientos" ON movimientos_creditos FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "Usuarios pueden registrar consumo" ON movimientos_creditos FOR INSERT WITH CHECK (auth.uid() = id_usuario AND tipo_movimiento = 'consumo');
CREATE POLICY "Admins pueden ver movimientos" ON movimientos_creditos FOR SELECT USING (public.es_admin());
CREATE POLICY "Admins pueden insertar movimientos" ON movimientos_creditos FOR INSERT WITH CHECK (public.es_admin());


-- 6. Función segura para descontar créditos desde el backend
CREATE OR REPLACE FUNCTION descontar_creditos(cantidad INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    creditos_actuales INTEGER;
BEGIN
    -- Obtener créditos actuales
    SELECT creditos_disponibles INTO creditos_actuales FROM perfiles WHERE id = auth.uid();
    
    -- Verificar si tiene suficientes
    IF creditos_actuales >= cantidad THEN
        UPDATE perfiles SET creditos_disponibles = creditos_disponibles - cantidad WHERE id = auth.uid();
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Otorgar permisos sobre todas las tablas, secuencias y funciones al API de Supabase
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

