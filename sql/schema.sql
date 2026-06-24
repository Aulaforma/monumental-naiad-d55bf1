-- 1. Tabla de Perfiles de Usuarios (Extiende auth.users de Supabase)
CREATE TABLE perfiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nombre_completo TEXT,
    correo TEXT,
    tipo_usuario TEXT,
    creditos_disponibles INTEGER DEFAULT 1,
    prueba_gratuita_usada BOOLEAN DEFAULT TRUE,
    estado_usuario TEXT DEFAULT 'activo',
    is_admin BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar Row Level Security para perfiles
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para perfiles
-- Los usuarios pueden leer su propio perfil
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON perfiles FOR SELECT 
USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
ON perfiles FOR UPDATE 
USING (auth.uid() = id);

-- Los administradores pueden ver todos los perfiles
CREATE POLICY "Administradores pueden ver todos los perfiles" 
ON perfiles FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true
    )
);

-- Administradores pueden actualizar todos los perfiles (para cargar créditos, suspender, etc)
CREATE POLICY "Administradores pueden actualizar todos los perfiles" 
ON perfiles FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true
    )
);

-- Trigger para crear un perfil automáticamente cuando un usuario se registra en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, correo, nombre_completo, tipo_usuario)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'nombre_completo', 
    new.raw_user_meta_data->>'tipo_usuario'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Tabla de Packs de Créditos
CREATE TABLE packs_creditos (
    id_pack SERIAL PRIMARY KEY,
    nombre_pack TEXT NOT NULL,
    cantidad_creditos INTEGER NOT NULL,
    precio INTEGER NOT NULL,
    estado_pack TEXT DEFAULT 'activo'
);

-- Insertar los packs por defecto
INSERT INTO packs_creditos (nombre_pack, cantidad_creditos, precio) VALUES
('Prueba gratuita', 1, 0),
('Pack Inicial', 10, 3500),
('Pack Docente', 15, 4990),
('Pack Aula', 25, 7990),
('Pack Departamento', 50, 14990),
('Pack UTP', 100, 29990);

-- RLS: Todos pueden ver los packs activos
ALTER TABLE packs_creditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos pueden ver packs activos" ON packs_creditos FOR SELECT USING (estado_pack = 'activo');


-- 3. Tabla de Compras
CREATE TABLE compras (
    id_compra UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES perfiles(id),
    id_pack INTEGER REFERENCES packs_creditos(id_pack),
    monto INTEGER NOT NULL,
    estado_pago TEXT DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
    metodo_pago TEXT DEFAULT 'transferencia',
    fecha_compra TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_activacion TIMESTAMP WITH TIME ZONE
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver e insertar sus propias compras
CREATE POLICY "Usuarios pueden ver sus compras" ON compras FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "Usuarios pueden registrar compras" ON compras FOR INSERT WITH CHECK (auth.uid() = id_usuario);

-- Administradores pueden ver y actualizar compras
CREATE POLICY "Admins pueden ver compras" ON compras FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins pueden actualizar compras" ON compras FOR UPDATE USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true));


-- 4. Tabla de Documentos Generados (Historial)
CREATE TABLE documentos_generados (
    id_documento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES perfiles(id),
    asignatura TEXT,
    curso TEXT,
    tipo_instrumento TEXT,
    creditos_usados INTEGER,
    nombre_documento TEXT,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE documentos_generados ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus documentos e insertarlos
CREATE POLICY "Usuarios pueden ver sus documentos" ON documentos_generados FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "Usuarios pueden registrar documentos" ON documentos_generados FOR INSERT WITH CHECK (auth.uid() = id_usuario);

-- Administradores pueden ver todos
CREATE POLICY "Admins pueden ver documentos" ON documentos_generados FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true));


-- 5. Tabla de Movimientos de Créditos (Auditoría)
CREATE TABLE movimientos_creditos (
    id_movimiento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES perfiles(id),
    tipo_movimiento TEXT, -- carga, consumo, ajuste, devolucion
    cantidad_creditos INTEGER,
    motivo TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_admin UUID REFERENCES perfiles(id) NULL
);

ALTER TABLE movimientos_creditos ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver sus movimientos
CREATE POLICY "Usuarios pueden ver sus movimientos" ON movimientos_creditos FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "Usuarios pueden registrar consumo" ON movimientos_creditos FOR INSERT WITH CHECK (auth.uid() = id_usuario AND tipo_movimiento = 'consumo');

-- Administradores pueden ver e insertar todo
CREATE POLICY "Admins pueden ver movimientos" ON movimientos_creditos FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins pueden insertar movimientos" ON movimientos_creditos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND is_admin = true));


-- FUNCION RPC PARA DESCONTAR CREDITOS DE FORMA SEGURA (Para que Netlify lo use vía Anon Key o los propios usuarios)
CREATE OR REPLACE FUNCTION descontar_creditos(cantidad INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    creditos_actuales INTEGER;
BEGIN
    -- Obtener creditos del usuario actual (quien llama a la funcion)
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
